import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import { apiFunction } from "./lambda";

// Step 1: an HTTP API. It is cheaper and simpler than a REST API, and it is enough for a proxy to Lambda.
export const httpApi = new aws.apigatewayv2.Api("api", {
  protocolType: "HTTP",
  // CORS: allow every origin for now so a local frontend can call it.
  // Phase 3 locks this down to the real web domain.
  corsConfiguration: {
    allowOrigins: ["*"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["content-type", "authorization"],
  },
});

// Step 2: the integration says "forward requests to this Lambda".
// AWS_PROXY passes the whole request through. Payload format 2.0 is the newer, smaller event shape.
const integration = new aws.apigatewayv2.Integration("api-lambda", {
  apiId: httpApi.id,
  integrationType: "AWS_PROXY",
  integrationUri: apiFunction.invokeArn,
  payloadFormatVersion: "2.0",
});

// Step 3: one catch-all route. Fastify does the real routing inside the Lambda.
// Note: "/{proxy+}" needs at least one path segment, so a bare "/" is NOT matched (404 from API Gateway).
new aws.apigatewayv2.Route("api-catch-all", {
  apiId: httpApi.id,
  routeKey: "ANY /{proxy+}",
  target: pulumi.interpolate`integrations/${integration.id}`,
});

// Step 4: the "$default" stage serves at the API's base URL, with no "/dev" prefix.
// autoDeploy publishes route changes automatically.
// Low throttling caps cost if someone floods the URL: about 20 req/s steady, with bursts up to 40.
export const stage = new aws.apigatewayv2.Stage("api-default-stage", {
  apiId: httpApi.id,
  name: "$default",
  autoDeploy: true,
  defaultRouteSettings: {
    throttlingRateLimit: 20,
    throttlingBurstLimit: 40,
  },
});

// Step 5: a resource policy on the Lambda. It lets ONLY this API invoke the function.
// executionArn/*/* means any stage and any method/route of this API, and nothing else.
new aws.lambda.Permission("api-invoke-lambda", {
  action: "lambda:InvokeFunction",
  function: apiFunction.name,
  principal: "apigateway.amazonaws.com",
  sourceArn: pulumi.interpolate`${httpApi.executionArn}/*/*`,
});
