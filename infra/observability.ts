// Alarms and a dashboard. Every alarm notifies the `alarms` SNS topic (email). CONCEPT: alarms, dashboards
// Alarm count is kept at 7 (the first 10 alarms are free each month).
import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";
import { alertEmail, stage } from "./config";
import { emailDlq } from "./events";
import { httpApi } from "./http-api";
import { bookingStateMachine } from "./stepfunctions";
import { search } from "./search";
import { posterFailuresQueue } from "./uploads";

// Step 1: where alarms go.
export const alarmTopic = new aws.sns.Topic("alarms", { name: `ticketlite-alarms-${stage}` });
new aws.sns.TopicSubscription("alarms-email", {
  topic: alarmTopic.arn,
  protocol: "email",
  endpoint: alertEmail,
});

// Step 2: a small helper. "Sum over 5 minutes > threshold, once" = alarm. Missing data (no traffic) is fine.
type AlarmArgs = {
  namespace: string;
  metricName: string;
  dimensions?: Record<string, pulumi.Input<string>>;
  threshold?: number;
  statistic?: string;
};
const alarm = (name: string, description: string, args: AlarmArgs) =>
  new aws.cloudwatch.MetricAlarm(name, {
    name: `ticketlite-${stage}-${name}`,
    alarmDescription: description,
    namespace: args.namespace,
    metricName: args.metricName,
    dimensions: args.dimensions,
    statistic: args.statistic ?? "Sum",
    period: 300,
    evaluationPeriods: 1,
    threshold: args.threshold ?? 0,
    comparisonOperator: "GreaterThanThreshold",
    treatMissingData: "notBreaching",
    alarmActions: [alarmTopic.arn],
    okActions: [alarmTopic.arn], // also tell us when it recovers
  });

// Step 3: the alarms.
alarm("api-5xx", "The HTTP API returned 5xx errors", {
  namespace: "AWS/ApiGateway",
  metricName: "5xx",
  dimensions: { ApiId: httpApi.id, Stage: "$default" },
});
// Without a FunctionName dimension, Lambda's metrics cover EVERY function in the region: one alarm for all.
alarm("lambda-errors", "A Lambda function threw an error", { namespace: "AWS/Lambda", metricName: "Errors" });
alarm("lambda-throttles", "Lambda throttled invocations (concurrency limit reached)", {
  namespace: "AWS/Lambda",
  metricName: "Throttles",
});
alarm(
  "booking-saga-failed",
  "A booking saga execution FAILED (ConfirmFailed / CompensationFailed): needs a human",
  {
    namespace: "AWS/States",
    metricName: "ExecutionsFailed",
    dimensions: { StateMachineArn: bookingStateMachine.arn },
  },
);
// Any message in a DLQ means something failed for good.
const queueDepth = (name: string, queue: aws.sqs.Queue) =>
  alarm(name, `Messages are waiting in ${name}`, {
    namespace: "AWS/SQS",
    metricName: "ApproximateNumberOfMessagesVisible",
    dimensions: { QueueName: queue.name },
    statistic: "Maximum",
  });
queueDepth("email-dlq", emailDlq);
queueDepth("poster-failures", posterFailuresQueue);
if (search) queueDepth("search-indexer-failures", search.failures);

// Step 4: one dashboard (the first 3 are free). Each widget is a small JSON definition.
const widget = (title: string, metrics: unknown[][], x: number, y: number) => ({
  type: "metric",
  x,
  y,
  width: 12,
  height: 6,
  properties: { title, metrics, region: "us-east-1", stat: "Sum", period: 300 },
});
new aws.cloudwatch.Dashboard("main", {
  dashboardName: `ticketlite-${stage}`,
  dashboardBody: pulumi.jsonStringify({
    widgets: [
      widget(
        "Bookings",
        [
          ["TicketLite", "BookingsStarted", "service", "api"],
          ["TicketLite", "BookingsConfirmed", "service", "booking-confirm"],
          ["TicketLite", "BookingsFailed", "service", "booking-release-seat"],
          ["TicketLite", "PaymentFailures", "service", "booking-process-payment"],
        ],
        0,
        0,
      ),
      widget(
        "HTTP API",
        [
          ["AWS/ApiGateway", "Count", "ApiId", httpApi.id, "Stage", "$default"],
          ["AWS/ApiGateway", "4xx", "ApiId", httpApi.id, "Stage", "$default"],
          ["AWS/ApiGateway", "5xx", "ApiId", httpApi.id, "Stage", "$default"],
        ],
        12,
        0,
      ),
      widget(
        "Lambda (all functions)",
        [
          ["AWS/Lambda", "Invocations"],
          ["AWS/Lambda", "Errors"],
          ["AWS/Lambda", "Throttles"],
        ],
        0,
        6,
      ),
      widget(
        "Booking saga + queues",
        [
          ["AWS/States", "ExecutionsSucceeded", "StateMachineArn", bookingStateMachine.arn],
          ["AWS/States", "ExecutionsFailed", "StateMachineArn", bookingStateMachine.arn],
          ["AWS/SQS", "ApproximateNumberOfMessagesVisible", "QueueName", emailDlq.name, { stat: "Maximum" }],
        ],
        12,
        6,
      ),
    ],
  }),
});
