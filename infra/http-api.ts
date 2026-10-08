// The public HTTP API (API Gateway v2): the API itself, its stage and access logs.
// Routes, the Lambda integration and the JWT authorizer live in http-routes.ts. They are split only
// to avoid an import cycle: CloudFront needs this API's URL, Cognito needs CloudFront's URL, and the
// routes need Cognito (authorizer) and the Lambda (which needs Cognito's IDs).
// (The partner API in partner-api.ts is a REST API, because only REST APIs have API keys + usage plans.)
import * as aws from "@pulumi/aws";
import { localWebOrigin, stage } from "./config";

// Step 1: the API. CORS allows ONLY the local Next.js dev server. In the cloud the browser calls
// /api/* on the CloudFront domain (same origin), so production traffic never needs CORS. CONCEPT: cors
export const httpApi = new aws.apigatewayv2.Api("http-api", {
  protocolType: "HTTP",
  corsConfiguration: {
    allowOrigins: [localWebOrigin],
    allowCredentials: true,
    allowMethods: ["GET", "POST", "PUT", "DELETE"],
    allowHeaders: [
      "content-type",
      "authorization",
      "idempotency-key",
      "x-csrf",
      "x-correlation-id",
      "if-none-match",
    ],
    exposeHeaders: ["x-correlation-id", "etag", "retry-after"],
    maxAge: 600,
  },
});

// Step 2: access logs, one JSON line per request, kept 7 days. These are API Gateway's logs (status,
// latency, caller IP), separate from the Lambda's own logs.
const accessLogs = new aws.cloudwatch.LogGroup("http-api-access-logs", {
  name: `/aws/apigateway/ticketlite-http-api-${stage}`,
  retentionInDays: 7,
});

// Step 3: the "$default" stage serves at the API's base URL, with no "/dev" prefix. autoDeploy
// publishes route changes automatically. Low throttling caps cost if someone floods the URL.
// CONCEPT: throttling
export const httpStage = new aws.apigatewayv2.Stage("http-api-default-stage", {
  apiId: httpApi.id,
  name: "$default",
  autoDeploy: true,
  defaultRouteSettings: { throttlingRateLimit: 20, throttlingBurstLimit: 40 },
  accessLogSettings: {
    destinationArn: accessLogs.arn,
    format: JSON.stringify({
      requestId: "$context.requestId",
      ip: "$context.identity.sourceIp",
      method: "$context.httpMethod",
      path: "$context.path",
      status: "$context.status",
      latencyMs: "$context.responseLatency",
      integrationError: "$context.integrationErrorMessage",
      authorizerError: "$context.authorizer.error",
    }),
  },
});
