// The booking saga: three step Lambdas + one compensation Lambda, orchestrated by a Step Functions
// STANDARD state machine. The definition is in booking-state-machine.asl.json, explained in
// booking-state-machine.md. CONCEPT: saga, orchestration
import * as fs from "node:fs";
import * as path from "node:path";
import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";
import { graphqlUrl, publishSeatUpdateArn } from "./appsync";
import { paymentFailureRate, stage } from "./config";
import { bookingsTable, eventsTable } from "./dynamodb";
import { eventBus } from "./events";
import { createNodeFunction } from "./node-function";
import { paymentSecret } from "./secrets";

// Step 1: the saga Lambdas. Each gets only the table actions it uses (TransactWriteItems needs UpdateItem).
const tables = { EVENTS_TABLE: eventsTable.name, BOOKINGS_TABLE: bookingsTable.name };
const updateBoth = [{ Action: ["dynamodb:UpdateItem"], Resource: [eventsTable.arn, bookingsTable.arn] }];

const reserveSeat = createNodeFunction("booking-reserve-seat", {
  codeDir: "../functions/booking-reserve-seat/dist",
  environment: tables,
  statements: updateBoth,
});
const processPayment = createNodeFunction("booking-process-payment", {
  codeDir: "../functions/booking-process-payment/dist",
  environment: { PAYMENT_FAILURE_RATE: String(paymentFailureRate), PAYMENT_SECRET_ARN: paymentSecret.arn },
  statements: [{ Action: ["secretsmanager:GetSecretValue"], Resource: [paymentSecret.arn] }],
});
// Confirm and ReleaseSeat also read the new seat count and publish it to AppSync (IAM: only that mutation).
// Both also publish a domain event (BookingConfirmed / BookingFailed) to the EventBridge bus.
const liveUpdate = [
  { Action: ["dynamodb:GetItem"], Resource: [eventsTable.arn] },
  { Action: ["appsync:GraphQL"], Resource: [publishSeatUpdateArn] },
  { Action: ["events:PutEvents"], Resource: [eventBus.arn] },
];
const confirm = createNodeFunction("booking-confirm", {
  codeDir: "../functions/booking-confirm/dist",
  environment: { ...tables, APPSYNC_URL: graphqlUrl, EVENT_BUS_NAME: eventBus.name },
  statements: [{ Action: ["dynamodb:UpdateItem"], Resource: [bookingsTable.arn] }, ...liveUpdate],
});
const releaseSeat = createNodeFunction("booking-release-seat", {
  codeDir: "../functions/booking-release-seat/dist",
  environment: { ...tables, APPSYNC_URL: graphqlUrl, EVENT_BUS_NAME: eventBus.name },
  statements: [...updateBoth, ...liveUpdate],
});
const sagaFunctions = [reserveSeat, processPayment, confirm, releaseSeat];

// Step 2: the state machine's own role: invoke exactly these four functions, update bookings directly
// (the MarkFailed state), write traces and logs.
const sfnRole = new aws.iam.Role("booking-saga-role", {
  assumeRolePolicy: aws.iam.assumeRolePolicyForPrincipal({ Service: "states.amazonaws.com" }),
});
new aws.iam.RolePolicy("booking-saga-policy", {
  role: sfnRole.name,
  policy: pulumi.jsonStringify({
    Version: "2012-10-17",
    Statement: [
      { Effect: "Allow", Action: ["lambda:InvokeFunction"], Resource: sagaFunctions.map((f) => f.fn.arn) },
      { Effect: "Allow", Action: ["dynamodb:UpdateItem"], Resource: [bookingsTable.arn] },
      { Effect: "Allow", Action: ["events:PutEvents"], Resource: [eventBus.arn] }, // the PublishSoldOut state
      {
        Effect: "Allow",
        Action: [
          "xray:PutTraceSegments",
          "xray:PutTelemetryRecords",
          "xray:GetSamplingRules",
          "xray:GetSamplingTargets",
        ],
        Resource: ["*"],
      },
      // CloudWatch Logs "vended log" delivery. These actions don't support resource-level permissions.
      {
        Effect: "Allow",
        Action: [
          "logs:CreateLogDelivery",
          "logs:GetLogDelivery",
          "logs:UpdateLogDelivery",
          "logs:DeleteLogDelivery",
          "logs:ListLogDeliveries",
          "logs:PutResourcePolicy",
          "logs:DescribeResourcePolicies",
          "logs:DescribeLogGroups",
        ],
        Resource: ["*"],
      },
    ],
  }),
});

// Step 3: fill the placeholders in the ASL file with real ARNs and names.
const template = fs.readFileSync(path.join(__dirname, "booking-state-machine.asl.json"), "utf8");
const definition = pulumi
  .all([
    reserveSeat.fn.arn,
    processPayment.fn.arn,
    confirm.fn.arn,
    releaseSeat.fn.arn,
    bookingsTable.name,
    eventBus.name,
  ])
  .apply(([reserve, pay, conf, release, table, bus]) =>
    template
      .replaceAll("${ReserveSeatArn}", reserve)
      .replaceAll("${ProcessPaymentArn}", pay)
      .replaceAll("${ConfirmArn}", conf)
      .replaceAll("${ReleaseSeatArn}", release)
      .replaceAll("${BookingsTable}", table)
      .replaceAll("${EventBusName}", bus),
  );

// Step 4: the state machine. ERROR-level logs (failed states only) keep log costs near zero.
const sfnLogs = new aws.cloudwatch.LogGroup("booking-saga-logs", {
  name: `/aws/vendedlogs/states/ticketlite-booking-${stage}`,
  retentionInDays: 7,
});
export const bookingStateMachine = new aws.sfn.StateMachine("booking-saga", {
  name: `ticketlite-booking-${stage}`,
  type: "STANDARD", // exactly-once steps, up to 1 year, visual history. See docs/adr/0005-standard-workflow.md
  roleArn: sfnRole.arn,
  definition,
  tracingConfiguration: { enabled: true }, // X-Ray across the API, the state machine and every Lambda
  loggingConfiguration: {
    level: "ERROR",
    includeExecutionData: false, // don't copy booking data into logs
    logDestination: pulumi.interpolate`${sfnLogs.arn}:*`,
  },
});
