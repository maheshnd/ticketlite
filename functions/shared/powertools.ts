// Powertools for AWS Lambda: one Logger and one Tracer per function, created at module level (once per
// cold start). The service name comes from the POWERTOOLS_SERVICE_NAME env var set in Pulumi.
//   Logger: structured JSON logs with the function's context (request id, cold start flag, ...).
//   Tracer: X-Ray segments for the handler and every AWS SDK call. CONCEPT: structured-logging, distributed-tracing
import { Logger } from "@aws-lambda-powertools/logger";
import { Tracer } from "@aws-lambda-powertools/tracer";

export const logger = new Logger();
export const tracer = new Tracer();
