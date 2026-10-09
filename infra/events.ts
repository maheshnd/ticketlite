// Event-driven processing: a custom EventBridge bus, rules, an SQS queue + DLQ for emails, and an SNS
// topic that fans out to admins. CONCEPT: event-driven, choreography, queues, dlq, fan-out
//
//   saga --BookingConfirmed--> bus --rule--> SQS email-queue --> email-worker --> SES
//                                   \--rule--> SNS admin-notifications --> email (admins)
//   saga --BookingFailed-----> bus --rule--> SNS admin-notifications
//   api  --EventCreated------> bus           (no rule yet: new consumers can subscribe without changing the API)
import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";
import { alertEmail, sesEmail, stage } from "./config";
import { bookingsTable } from "./dynamodb";
import { createNodeFunction } from "./node-function";

// Step 1: the bus. Publishers only know its name; rules decide who receives what.
export const eventBus = new aws.cloudwatch.EventBus("bus", { name: `ticketlite-${stage}` });

// Step 2: SES identity. SES (sandbox) emails the address to confirm it; click the link once.
const sesIdentity = new aws.sesv2.EmailIdentity("ses-sender", { emailIdentity: sesEmail });

// Step 3: the email queue + its dead-letter queue.
// Visibility timeout (60s) > 6 x the worker's timeout (10s): while one copy works on a message, no other copy
// can receive it. After 3 failed receives, SQS moves the message to the DLQ for a human to look at.
export const emailDlq = new aws.sqs.Queue("email-dlq", {
  messageRetentionSeconds: 14 * 24 * 60 * 60,
  sqsManagedSseEnabled: true,
});
export const emailQueue = new aws.sqs.Queue("email-queue", {
  visibilityTimeoutSeconds: 60,
  sqsManagedSseEnabled: true,
  redrivePolicy: pulumi.jsonStringify({ deadLetterTargetArn: emailDlq.arn, maxReceiveCount: 3 }),
});

// Step 4: the worker, and the SQS -> Lambda event source mapping (Lambda polls the queue for us).
const emailWorker = createNodeFunction("email-worker", {
  codeDir: "../functions/email-worker/dist",
  environment: { BOOKINGS_TABLE: bookingsTable.name, SES_EMAIL: sesEmail },
  statements: [
    // The event source mapping polls the queue AS this role (receive, delete after success, read settings).
    {
      Action: ["sqs:ReceiveMessage", "sqs:DeleteMessage", "sqs:GetQueueAttributes"],
      Resource: [emailQueue.arn],
    },
    // handler.ts: SESv2 SendEmail, from (and, in the sandbox, to) the verified identity only.
    { Action: ["ses:SendEmail"], Resource: [sesIdentity.arn] },
    // handler.ts: read the emailSentAt marker, then set it (a conditional UpdateItem).
    { Action: ["dynamodb:GetItem", "dynamodb:UpdateItem"], Resource: [bookingsTable.arn] },
  ],
});
new aws.lambda.EventSourceMapping("email-queue-to-worker", {
  eventSourceArn: emailQueue.arn,
  functionName: emailWorker.fn.name,
  batchSize: 5, // small batches: one bad message delays few others
  maximumBatchingWindowInSeconds: 5,
  functionResponseTypes: ["ReportBatchItemFailures"], // partial batch response. CONCEPT: partial-batch-response
  scalingConfig: { maximumConcurrency: 2 }, // at most 2 copies: gentle on SES's send rate
});

// Step 5: the admin topic (fan-out: every subscriber gets every message).
export const adminTopic = new aws.sns.Topic("admin-notifications", { name: `ticketlite-admin-${stage}` });
new aws.sns.TopicSubscription("admin-email", {
  topic: adminTopic.arn,
  protocol: "email",
  endpoint: alertEmail,
});

// Step 6: rules. An event pattern matches on the event's fields; each target receives matching events.
const rule = (name: string, detailTypes: string[]) =>
  new aws.cloudwatch.EventRule(name, {
    eventBusName: eventBus.name,
    eventPattern: JSON.stringify({ source: ["ticketlite.bookings"], "detail-type": detailTypes }),
  });
const confirmedRule = rule("booking-confirmed", ["BookingConfirmed"]);
const adminRule = rule("booking-outcomes", ["BookingConfirmed", "BookingFailed"]);

new aws.cloudwatch.EventTarget("confirmed-to-email-queue", {
  rule: confirmedRule.name,
  eventBusName: eventBus.name,
  arn: emailQueue.arn,
});
new aws.cloudwatch.EventTarget("outcomes-to-admin-topic", {
  rule: adminRule.name,
  eventBusName: eventBus.name,
  arn: adminTopic.arn,
});

// Step 7: let EventBridge (only these rules) write to the queue and the topic.
new aws.sqs.QueuePolicy("email-queue-policy", {
  queueUrl: emailQueue.url,
  policy: pulumi.jsonStringify({
    Version: "2012-10-17",
    Statement: [
      {
        Effect: "Allow",
        Principal: { Service: "events.amazonaws.com" },
        Action: "sqs:SendMessage",
        Resource: emailQueue.arn,
        Condition: { ArnEquals: { "aws:SourceArn": confirmedRule.arn } },
      },
    ],
  }),
});
new aws.sns.TopicPolicy("admin-topic-policy", {
  arn: adminTopic.arn,
  policy: pulumi.jsonStringify({
    Version: "2012-10-17",
    Statement: [
      {
        Effect: "Allow",
        Principal: { Service: "events.amazonaws.com" },
        Action: "sns:Publish",
        Resource: adminTopic.arn,
        Condition: { ArnEquals: { "aws:SourceArn": adminRule.arn } },
      },
    ],
  }),
});
