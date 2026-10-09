// The api Lambda ("Lambdalith": one Fastify app serving every REST route) and its live alias.
// The small single-job functions live with their service area (stepfunctions.ts, events.ts, uploads.ts, ...).
import * as aws from "@pulumi/aws";
import { appUrl } from "./cdn";
import { cognitoDomainUrl, userPool, userPoolClient } from "./cognito";
import { flags } from "./config";
import { bookingsTable, eventsTable, idempotencyTable, indexArns, sessionsTable } from "./dynamodb";
import { eventBus } from "./events";
import type { PolicyStatement } from "./iam";
import { createNodeFunction } from "./node-function";
import { search } from "./search";
import { redisSecret } from "./secrets";
import { sql } from "./sql";
import { bookingStateMachine } from "./stepfunctions";
import { postersBucket } from "./storage";

// Step 1: the api role's permissions: every AWS call the api code makes, mapped to the IAM action and the
// exact resource it needs. One entry per call site, so a new SDK call without a new entry here is easy
// to spot in review (and the post-deploy smoke tests fail with AccessDenied). CONCEPT: least-privilege
// Cognito needs NO entry: the api only calls public, token- or password-authenticated APIs (SignUp,
// ConfirmSignUp, InitiateAuth, GetUser, RevokeToken, ForgotPassword, ConfirmForgotPassword), never Admin*.
// The api never touches the Organizers table (AppSync's organizer-batch function does).
const apiStatements: PolicyStatement[] = [
  // api/src/repositories/events-repository.ts: get one event, create (admin), update with a version check.
  { Action: ["dynamodb:GetItem", "dynamodb:PutItem", "dynamodb:UpdateItem"], Resource: [eventsTable.arn] },
  // events-repository.ts: list by status (GSI byStatus) or by city (GSI byCity).
  { Action: ["dynamodb:Query"], Resource: [indexArns(eventsTable)] },
  // api/src/repositories/bookings-repository.ts: create a PENDING booking, read it (polling), record the
  // execution ARN or mark it FAILED when the saga can't start.
  { Action: ["dynamodb:GetItem", "dynamodb:PutItem", "dynamodb:UpdateItem"], Resource: [bookingsTable.arn] },
  // bookings-repository.ts: "my bookings" (GSI byUser).
  { Action: ["dynamodb:Query"], Resource: [indexArns(bookingsTable)] },
  // api/src/repositories/idempotency-repository.ts: claim a key, read it, finish it, release it.
  {
    Action: ["dynamodb:GetItem", "dynamodb:PutItem", "dynamodb:DeleteItem"],
    Resource: [idempotencyTable.arn],
  },
  // api/src/repositories/sessions-repository.ts: the session demo (create, read, delete a session row).
  {
    Action: ["dynamodb:GetItem", "dynamodb:PutItem", "dynamodb:DeleteItem"],
    Resource: [sessionsTable.arn],
  },
  // api/src/lib/stepfunctions.ts: start the booking saga, on this state machine only.
  { Action: ["states:StartExecution"], Resource: [bookingStateMachine.arn] },
  // api/src/lib/eventbridge.ts: publish EventCreated, on the ticketlite bus only.
  { Action: ["events:PutEvents"], Resource: [eventBus.arn] },
  // api/src/lib/s3.ts: a presigned POST is signed with the api role's credentials, so S3 checks THIS role's
  // permission when the browser uploads. The server-chosen keys are always posters/<eventId>/<uuid>.<ext>.
  { Action: ["s3:PutObject"], Resource: [postersBucket.arn.apply((arn) => `${arn}/posters/*`)] },
  // api/src/lib/redis.ts (flag enableCache): read the Upstash URL from Secrets Manager.
  ...(redisSecret ? [{ Action: ["secretsmanager:GetSecretValue"], Resource: [redisSecret.arn] }] : []),
  // api/src/services/search-service.ts (flag enableSearch): POST /events/_search, read-only.
  ...(search ? [search.apiAccess] : []),
  // api/src/services/reports-service.ts (flag enableSql): Data API ExecuteStatement + the cluster's secret.
  ...(sql ? sql.apiStatements : []),
];

// Step 2: the api function. The code is the esbuild bundle (`pnpm build:bundles` at the repo root first).
// publish: true creates a new numbered version on every code change. CONCEPT: lambda-versions
export const api = createNodeFunction("api", {
  codeDir: "../api/dist",
  memorySize: 512,
  // API Gateway gives up after 30s, so the Lambda must finish first; its own AWS calls have even
  // shorter timeouts (see api/src/lib). Inner timeouts < outer timeouts. CONCEPT: timeout-chain
  timeout: 10,
  publish: true,
  reservedConcurrency: flags.reservedConcurrency,
  // Names and IDs only, never secrets. Secrets come from Secrets Manager at runtime.
  environment: {
    EVENTS_TABLE: eventsTable.name,
    SESSIONS_TABLE: sessionsTable.name,
    BOOKINGS_TABLE: bookingsTable.name,
    IDEMPOTENCY_TABLE: idempotencyTable.name,
    BOOKING_STATE_MACHINE_ARN: bookingStateMachine.arn,
    POSTERS_BUCKET: postersBucket.bucket,
    EVENT_BUS_NAME: eventBus.name,
    // Flags: when off, the API falls back (no-op cache, DynamoDB search) instead of failing.
    CACHE_ENABLED: String(flags.enableCache),
    ...(redisSecret ? { REDIS_SECRET_ARN: redisSecret.arn } : {}),
    ...(search ? { OPENSEARCH_ENDPOINT: search.endpoint } : {}),
    ...(sql ? sql.env : {}),
    USER_POOL_ID: userPool.id,
    USER_POOL_CLIENT_ID: userPoolClient.id,
    COGNITO_DOMAIN_URL: cognitoDomainUrl,
    APP_URL: appUrl,
    API_PUBLIC_URL: appUrl, // same origin: CloudFront serves the web app AND /api/*
  },
  statements: apiStatements,
});

// Step 3: the "live" alias, a stable name that points at one version.
// API Gateway calls the alias, never $LATEST. A canary deploy would give the alias two versions with
// weights (e.g. 90% old / 10% new via `routingConfig`) and shift traffic once alarms stay green.
export const apiAlias = new aws.lambda.Alias("api-live", {
  name: "live",
  functionName: api.fn.name,
  functionVersion: api.fn.version,
});

// Step 4 (flag): keep N copies initialised and warm, so no user ever waits for a cold start.
// Billed every hour even with zero traffic, hence off by default. CONCEPT: cold-start
if (flags.enableProvisionedConcurrency) {
  new aws.lambda.ProvisionedConcurrencyConfig("api-provisioned", {
    functionName: api.fn.name,
    qualifier: apiAlias.name, // provisioned concurrency is set on an alias or version, never $LATEST
    provisionedConcurrentExecutions: 1,
  });
}
