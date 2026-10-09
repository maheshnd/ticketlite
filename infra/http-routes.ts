// Routes of the HTTP API: which requests reach the api Lambda, and which need a valid Cognito token first.
// Every route points at the SAME integration (the api Lambda's live alias); Fastify does the fine routing.
// Listing routes (instead of one catch-all) means unknown paths are rejected by API Gateway for free
// (docs/adr/0011-explicit-http-routes.md).
import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";
import { issuerUrl, userPoolClient } from "./cognito";
import { flags, stage } from "./config";
import { httpApi } from "./http-api";
import { protectedRoutes, publicRoutes, sqlRoutes } from "./http-route-list";
import { api, apiAlias } from "./lambdas";

// Step 1: one integration = "forward to the api Lambda's live alias".
// AWS_PROXY passes the whole request through. Payload format 2.0 is the newer, smaller event shape.
const integration = new aws.apigatewayv2.Integration("api-lambda", {
  apiId: httpApi.id,
  integrationType: "AWS_PROXY",
  integrationUri: apiAlias.invokeArn,
  payloadFormatVersion: "2.0",
  timeoutMilliseconds: 29_000, // API Gateway's own limit is 30s; the Lambda times out at 10s, well before
});
const target = pulumi.interpolate`integrations/${integration.id}`;

// Step 2: the JWT authorizer. API Gateway checks the token's signature (against Cognito's public keys),
// expiry, issuer and audience BEFORE calling Lambda, so requests without a valid token never cost a
// Lambda invocation. Access tokens have no "aud" claim; API Gateway then checks "client_id" instead.
// CONCEPT: jwt, authentication
const jwtAuthorizer = new aws.apigatewayv2.Authorizer("cognito-jwt", {
  apiId: httpApi.id,
  authorizerType: "JWT",
  identitySources: ["$request.header.Authorization"],
  jwtConfiguration: { issuer: issuerUrl, audiences: [userPoolClient.id] },
});

// Step 3: the route lists live in http-route-list.ts (plain data, so a unit test can compare them with the
// Fastify app). The reports route is added only with enableSql.
const protectedRouteKeys = [...protectedRoutes, ...(flags.enableSql ? sqlRoutes : [])];

// Step 4: one API Gateway route per key, all with the same target; protected ones use the JWT authorizer.
// Pulumi resource names can't contain "/" or "{", so "GET /api/events/{id}" becomes "route-GET-api-events-id".
const routeName = (routeKey: string) => `route-${routeKey.replace(/[^A-Za-z0-9]+/g, "-").replace(/-$/, "")}`;

const routes = [
  ...publicRoutes.map(
    (routeKey) => new aws.apigatewayv2.Route(routeName(routeKey), { apiId: httpApi.id, routeKey, target }),
  ),
  ...protectedRouteKeys.map(
    (routeKey) =>
      new aws.apigatewayv2.Route(routeName(routeKey), {
        apiId: httpApi.id,
        routeKey,
        target,
        authorizationType: "JWT",
        authorizerId: jwtAuthorizer.id,
      }),
  ),
];

// Step 5: access logs, one JSON line per request, kept 7 days. These are API Gateway's logs (status,
// latency, caller IP, authorizer errors), separate from the Lambda's own logs.
const accessLogs = new aws.cloudwatch.LogGroup("http-api-access-logs", {
  name: `/aws/apigateway/ticketlite-http-api-${stage}`,
  retentionInDays: 7,
});

// Step 6: the "$default" stage serves at the API's base URL, with no "/dev" prefix. autoDeploy publishes
// route changes automatically. CONCEPT: throttling
//   - every route: 20 requests/s steady, bursts up to 40 (caps cost if someone floods the URL)
//   - POST /api/bookings: 5/s, bursts of 10. Bookings start a Step Functions execution, the expensive path.
// Created after the routes, because per-route settings must name a route that already exists.
export const httpStage = new aws.apigatewayv2.Stage(
  "http-api-default-stage",
  {
    apiId: httpApi.id,
    name: "$default",
    autoDeploy: true,
    defaultRouteSettings: { throttlingRateLimit: 20, throttlingBurstLimit: 40 },
    routeSettings: [{ routeKey: "POST /api/bookings", throttlingRateLimit: 5, throttlingBurstLimit: 10 }],
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
  },
  { dependsOn: routes },
);

// Step 7: a resource policy on the alias. It lets ONLY this API invoke it.
// executionArn/*/* means any stage and any method/route of this API, and nothing else.
new aws.lambda.Permission("http-api-invoke-api", {
  action: "lambda:InvokeFunction",
  function: api.fn.name,
  qualifier: apiAlias.name,
  principal: "apigateway.amazonaws.com",
  sourceArn: pulumi.interpolate`${httpApi.executionArn}/*/*`,
});
