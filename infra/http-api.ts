// The public HTTP API (API Gateway v2) in front of the api Lambda.
// An HTTP API is cheaper and simpler than a REST API, and enough to proxy to Lambda.
// (The partner API in partner-api.ts is a REST API, because only REST APIs have API keys + usage plans.)
import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";
import { localWebOrigin, stage } from "./config";
import { api, apiAlias } from "./lambdas";

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

// Step 2: one integration = "forward to the api Lambda's live alias".
// AWS_PROXY passes the whole request through. Payload format 2.0 is the newer, smaller event shape.
const integration = new aws.apigatewayv2.Integration("api-lambda", {
  apiId: httpApi.id,
  integrationType: "AWS_PROXY",
  integrationUri: apiAlias.invokeArn,
  payloadFormatVersion: "2.0",
  timeoutMilliseconds: 29_000, // API Gateway's own limit is 30s; the Lambda times out at 10s, well before
});
const target = pulumi.interpolate`integrations/${integration.id}`;

// Step 3: explicit PUBLIC routes, all pointing at the same integration. Fastify does the fine routing.
// Listing routes (instead of one catch-all) means unknown paths are rejected by API Gateway for free,
// and protected routes (M2) can get the JWT authorizer while these stay open.
const publicRoutes = [
  "GET /api/health",
  "GET /api/copy-info",
  "GET /api/events",
  "GET /api/events/{id}",
  "GET /api/docs",
  "GET /api/docs/{proxy+}",
];
// Pulumi resource names can't contain "/" or "{", so "GET /api/events/{id}" becomes "route-GET-api-events-id".
const routeName = (routeKey: string) => `route-${routeKey.replace(/[^A-Za-z0-9]+/g, "-").replace(/-$/, "")}`;

for (const routeKey of publicRoutes) {
  new aws.apigatewayv2.Route(routeName(routeKey), { apiId: httpApi.id, routeKey, target });
}

// Step 4: access logs, one JSON line per request, kept 7 days. These are API Gateway's logs (status,
// latency, caller IP), separate from the Lambda's own logs.
const accessLogs = new aws.cloudwatch.LogGroup("http-api-access-logs", {
  name: `/aws/apigateway/ticketlite-http-api-${stage}`,
  retentionInDays: 7,
});

// Step 5: the "$default" stage serves at the API's base URL, with no "/dev" prefix. autoDeploy
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
    }),
  },
});

// Step 6: a resource policy on the alias. It lets ONLY this API invoke it.
// executionArn/*/* means any stage and any method/route of this API, and nothing else.
new aws.lambda.Permission("http-api-invoke-api", {
  action: "lambda:InvokeFunction",
  function: api.fn.name,
  qualifier: apiAlias.name,
  principal: "apigateway.amazonaws.com",
  sourceArn: pulumi.interpolate`${httpApi.executionArn}/*/*`,
});
