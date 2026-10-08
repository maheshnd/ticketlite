// Routes of the HTTP API: which requests reach the api Lambda, and which need a valid Cognito token first.
// Every route points at the SAME integration (the api Lambda's live alias); Fastify does the fine routing.
// Listing routes (instead of one catch-all) means unknown paths are rejected by API Gateway for free.
import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";
import { issuerUrl, userPoolClient } from "./cognito";
import { httpApi } from "./http-api";
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

// Step 3: PUBLIC routes: anyone may call them.
const publicRoutes = [
  "GET /api/health",
  "GET /api/copy-info",
  "GET /api/docs",
  "GET /api/docs/{proxy+}",
  "GET /api/events",
  "GET /api/events/{id}",
  // Auth endpoints are public by nature (you have no token yet). refresh/logout use the HttpOnly cookie.
  "POST /api/auth/signup",
  "POST /api/auth/confirm",
  "POST /api/auth/login",
  "POST /api/auth/refresh",
  "POST /api/auth/logout",
  "POST /api/auth/forgot",
  "POST /api/auth/reset",
  "GET /api/auth/oauth/start",
  "GET /api/auth/oauth/callback",
  // The session demo uses its own cookie, not a JWT.
  "POST /api/demo/session/login",
  "GET /api/demo/session/me",
  "POST /api/demo/session/logout",
];

// Step 4: PROTECTED routes: API Gateway rejects them with 401 unless the JWT authorizer passes.
// Finer rules (admin group, "only your own booking") are checked in Fastify. CONCEPT: rbac
const protectedRoutes = ["GET /api/me"];

// Pulumi resource names can't contain "/" or "{", so "GET /api/events/{id}" becomes "route-GET-api-events-id".
const routeName = (routeKey: string) => `route-${routeKey.replace(/[^A-Za-z0-9]+/g, "-").replace(/-$/, "")}`;

for (const routeKey of publicRoutes) {
  new aws.apigatewayv2.Route(routeName(routeKey), { apiId: httpApi.id, routeKey, target });
}
for (const routeKey of protectedRoutes) {
  new aws.apigatewayv2.Route(routeName(routeKey), {
    apiId: httpApi.id,
    routeKey,
    target,
    authorizationType: "JWT",
    authorizerId: jwtAuthorizer.id,
  });
}

// Step 5: a resource policy on the alias. It lets ONLY this API invoke it.
// executionArn/*/* means any stage and any method/route of this API, and nothing else.
new aws.lambda.Permission("http-api-invoke-api", {
  action: "lambda:InvokeFunction",
  function: api.fn.name,
  qualifier: apiAlias.name,
  principal: "apigateway.amazonaws.com",
  sourceArn: pulumi.interpolate`${httpApi.executionArn}/*/*`,
});
