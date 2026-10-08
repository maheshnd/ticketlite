// The Lambda functions. M1 has only the api ("Lambdalith": one Fastify app serving every REST route).
// Later milestones add the small single-job functions (saga steps, workers, indexers) here.
import * as aws from "@pulumi/aws";
import { appUrl, cognitoDomainUrl, userPool, userPoolClient } from "./cognito";
import { flags } from "./config";
import { eventsTable, organizersTable, sessionsTable, tableResources } from "./dynamodb";
import { createNodeFunction } from "./node-function";

// Step 1: the api function. The code is the esbuild bundle (`pnpm build` at the repo root first).
// publish: true creates a new numbered version on every code change. CONCEPT: lambda-versions
export const api = createNodeFunction("api", {
  codeDir: "../api/dist",
  memorySize: 512,
  // API Gateway gives up after 30s, so the Lambda must finish first; its own AWS calls have even
  // shorter timeouts (see api/src/lib). Inner timeouts < outer timeouts. CONCEPT: timeout-chain
  timeout: 10,
  publish: true,
  reservedConcurrency: flags.reservedConcurrency,
  // Names and IDs only, never secrets. Secrets come from Secrets Manager at runtime (M5).
  environment: {
    EVENTS_TABLE: eventsTable.name,
    ORGANIZERS_TABLE: organizersTable.name,
    SESSIONS_TABLE: sessionsTable.name,
    USER_POOL_ID: userPool.id,
    USER_POOL_CLIENT_ID: userPoolClient.id,
    COGNITO_DOMAIN_URL: cognitoDomainUrl,
    APP_URL: appUrl,
    API_PUBLIC_URL: appUrl, // same origin: CloudFront serves the web app AND /api/*
  },
  // Exactly the DynamoDB actions the api uses, on exactly its tables. Cognito calls (SignUp, InitiateAuth,
  // ...) need no IAM permission: they are public APIs authenticated by the user's password or token.
  statements: [
    {
      Action: ["dynamodb:GetItem", "dynamodb:Query", "dynamodb:PutItem", "dynamodb:UpdateItem"],
      Resource: tableResources(eventsTable),
    },
    { Action: ["dynamodb:GetItem", "dynamodb:BatchGetItem"], Resource: tableResources(organizersTable) },
    {
      Action: ["dynamodb:GetItem", "dynamodb:PutItem", "dynamodb:DeleteItem"],
      Resource: [sessionsTable.arn],
    },
  ],
});

// Step 2: the "live" alias, a stable name that points at one version.
// API Gateway calls the alias, never $LATEST. A canary deploy would give the alias two versions with
// weights (e.g. 90% old / 10% new via `routingConfig`) and shift traffic once alarms stay green.
export const apiAlias = new aws.lambda.Alias("api-live", {
  name: "live",
  functionName: api.fn.name,
  functionVersion: api.fn.version,
});

// Step 3 (flag): keep N copies initialised and warm, so no user ever waits for a cold start.
// Billed every hour even with zero traffic, hence off by default. CONCEPT: cold-start
if (flags.enableProvisionedConcurrency) {
  new aws.lambda.ProvisionedConcurrencyConfig("api-provisioned", {
    functionName: api.fn.name,
    qualifier: apiAlias.name, // provisioned concurrency is set on an alias or version, never $LATEST
    provisionedConcurrentExecutions: 1,
  });
}
