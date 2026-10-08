// The partner API: an API Gateway REST API (v1), because only REST APIs have API keys + usage plans.
// Each partner gets a key; the usage plan caps its rate (5 rps, burst 10) and its DAILY quota (1,000 calls).
// API Gateway enforces both before any Lambda runs (403 without a key, 429 over the limit).
// CONCEPT: api-keys-usage-plans, http-vs-rest-api
import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";
import { stage } from "./config";
import { api, apiAlias } from "./lambdas";

// Step 1: the API and its one resource path: /partner/events
export const partnerApi = new aws.apigateway.RestApi("partner-api", {
  name: `ticketlite-partner-${stage}`,
  endpointConfiguration: { types: "REGIONAL" },
});
const partner = new aws.apigateway.Resource("partner", {
  restApi: partnerApi.id,
  parentId: partnerApi.rootResourceId,
  pathPart: "partner",
});
const events = new aws.apigateway.Resource("partner-events", {
  restApi: partnerApi.id,
  parentId: partner.id,
  pathPart: "events",
});

// Step 2: GET with apiKeyRequired, proxied to the SAME api Lambda alias as the HTTP API (Fastify serves it).
const method = new aws.apigateway.Method("partner-events-get", {
  restApi: partnerApi.id,
  resourceId: events.id,
  httpMethod: "GET",
  authorization: "NONE",
  apiKeyRequired: true,
});
const integration = new aws.apigateway.Integration("partner-events-lambda", {
  restApi: partnerApi.id,
  resourceId: events.id,
  httpMethod: method.httpMethod,
  type: "AWS_PROXY",
  integrationHttpMethod: "POST", // Lambda is always invoked with POST, whatever the client's method
  uri: apiAlias.invokeArn,
});

// Step 3: a REST API needs an explicit deployment (a snapshot of the API) and a stage that points at it.
// `triggers` makes a new deployment whenever the routes change.
const deployment = new aws.apigateway.Deployment(
  "partner-deployment",
  {
    restApi: partnerApi.id,
    triggers: { redeploy: pulumi.jsonStringify([events.id, method.id, integration.id]) },
  },
  { dependsOn: [method, integration] },
);
export const partnerStage = new aws.apigateway.Stage("partner-v1", {
  restApi: partnerApi.id,
  deployment: deployment.id,
  stageName: "v1",
  xrayTracingEnabled: true, // REST APIs support X-Ray; HTTP APIs don't
});

// Step 4: the usage plan, one key, and the link between them.
const plan = new aws.apigateway.UsagePlan("partner-plan", {
  name: `ticketlite-partner-${stage}`,
  apiStages: [{ apiId: partnerApi.id, stage: partnerStage.stageName }],
  throttleSettings: { rateLimit: 5, burstLimit: 10 },
  quotaSettings: { limit: 1000, period: "DAY" },
});
export const partnerKey = new aws.apigateway.ApiKey("partner-demo-key", { name: `partner-demo-${stage}` });
new aws.apigateway.UsagePlanKey("partner-demo-plan-key", {
  keyId: partnerKey.id,
  keyType: "API_KEY",
  usagePlanId: plan.id,
});

// Step 5: let this REST API invoke the api alias.
new aws.lambda.Permission("partner-api-invoke-api", {
  action: "lambda:InvokeFunction",
  function: api.fn.name,
  qualifier: apiAlias.name,
  principal: "apigateway.amazonaws.com",
  sourceArn: pulumi.interpolate`${partnerApi.executionArn}/*/*`,
});

// Try: curl -H "x-api-key: $(pulumi stack output partnerApiKey --show-secrets)" "$(pulumi stack output partnerApiUrl)/partner/events"
export const partnerApiUrl = partnerStage.invokeUrl;
