// Powertools for AWS Lambda: one Logger, Tracer and Metrics per function, created at module level (once per
// cold start). The service name comes from POWERTOOLS_SERVICE_NAME, the metrics namespace from
// POWERTOOLS_METRICS_NAMESPACE ("TicketLite"), both set in infra/node-function.ts.
//   Logger:  structured JSON logs with the function's context. CONCEPT: structured-logging
//   Tracer:  X-Ray segments for every AWS SDK call. CONCEPT: distributed-tracing
//   Metrics: custom CloudWatch metrics via EMF (a JSON log line that CloudWatch turns into a metric:
//            no PutMetricData API call, no extra latency). CONCEPT: custom-metrics
import { Logger } from "@aws-lambda-powertools/logger";
import { Metrics, MetricUnit } from "@aws-lambda-powertools/metrics";
import { Tracer } from "@aws-lambda-powertools/tracer";

export const logger = new Logger();
export const tracer = new Tracer();
export const metrics = new Metrics();

// Counts one occurrence (e.g. "BookingsConfirmed") and writes it out straight away.
export function countMetric(name: "BookingsConfirmed" | "BookingsFailed" | "PaymentFailures") {
  metrics.addMetric(name, MetricUnit.Count, 1);
  metrics.publishStoredMetrics();
}
