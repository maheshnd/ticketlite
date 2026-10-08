// Custom CloudWatch metrics from the API, via Powertools (EMF: a JSON log line CloudWatch turns into a
// metric). Namespace "TicketLite", the same as the functions. CONCEPT: custom-metrics
import { Metrics, MetricUnit } from "@aws-lambda-powertools/metrics";
import { config } from "../config";

const metrics = new Metrics({ namespace: "TicketLite", serviceName: "api" });

export function countMetric(name: "BookingsStarted") {
  if (config.isLocal || config.stage === "test") return; // EMF only means something inside Lambda
  metrics.addMetric(name, MetricUnit.Count, 1);
  metrics.publishStoredMetrics();
}
