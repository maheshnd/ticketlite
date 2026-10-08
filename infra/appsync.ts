// AWS AppSync: the GraphQL API (read-heavy browsing + real-time seat updates).
// Schema: graphql/schema.graphql. Resolver code: graphql/resolvers/*.ts, bundled to graphql/dist by esbuild.
// CONCEPT: appsync-resolvers, appsync-auth-modes, pipeline-resolvers, n-plus-one, real-time
import * as fs from "node:fs";
import * as path from "node:path";
import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";
import { userPool } from "./cognito";
import { stage } from "./config";
import { bookingsTable, eventsTable, organizersTable, tableResources } from "./dynamodb";
import { createNodeFunction } from "./node-function";

const graphqlDir = path.join(__dirname, "..", "graphql");
const code = (name: string) => fs.readFileSync(path.join(graphqlDir, "dist", `${name}.js`), "utf8");
const runtime = { name: "APPSYNC_JS", runtimeVersion: "1.0.0" };

// Step 1: a role AppSync uses to write its own logs (resolver errors only, 7 days).
const logsRole = new aws.iam.Role("appsync-logs-role", {
  assumeRolePolicy: aws.iam.assumeRolePolicyForPrincipal({ Service: "appsync.amazonaws.com" }),
  managedPolicyArns: ["arn:aws:iam::aws:policy/service-role/AWSAppSyncPushToCloudWatchLogs"],
});

// Step 2: the API with three auth modes (see the comment at the top of schema.graphql).
export const graphqlApi = new aws.appsync.GraphQLApi("graphql", {
  name: `ticketlite-${stage}`,
  schema: fs.readFileSync(path.join(graphqlDir, "schema.graphql"), "utf8"),
  authenticationType: "AMAZON_COGNITO_USER_POOLS",
  userPoolConfig: { userPoolId: userPool.id, awsRegion: "us-east-1", defaultAction: "ALLOW" },
  additionalAuthenticationProviders: [{ authenticationType: "API_KEY" }, { authenticationType: "AWS_IAM" }],
  xrayEnabled: true,
  logConfig: { cloudwatchLogsRoleArn: logsRole.arn, fieldLogLevel: "ERROR", excludeVerboseContent: true },
  // Query safety: reject deeply nested queries (e.g. a malicious 20-level query) before any resolver runs.
  queryDepthLimit: 5,
  // Introspection lets tools discover the schema. Handy in dev; a prod stack would set "DISABLED".
  introspectionConfig: "ENABLED",
  // Caching (aws.appsync.ApiCache) is a paid, always-on instance, so it is NOT enabled. See docs.
});
new aws.cloudwatch.LogGroup("appsync-logs", {
  name: pulumi.interpolate`/aws/appsync/apis/${graphqlApi.id}`,
  retentionInDays: 7,
});

// Step 3: the public API key (visitors). It is NOT a secret: it ships inside the web app's JavaScript. It
// identifies public traffic and can be rotated. AppSync keys expire after at most 365 days, so we pick
// ~360 days on first create and ignore later diffs (redeploys must not churn the key).
export const apiKey = new aws.appsync.ApiKey(
  "public-key",
  {
    apiId: graphqlApi.id,
    description: "Public read access (events, live seat updates)",
    expires: new Date(Date.now() + 360 * 24 * 60 * 60 * 1000).toISOString().replace(/\.\d+Z$/, "Z"),
  },
  { ignoreChanges: ["expires"] },
);

// Step 4: data sources. AppSync assumes a role to reach DynamoDB: only these tables, only these actions.
const dsRole = new aws.iam.Role("appsync-ds-role", {
  assumeRolePolicy: aws.iam.assumeRolePolicyForPrincipal({ Service: "appsync.amazonaws.com" }),
});
const organizerBatch = createNodeFunction("appsync-organizer-batch", {
  codeDir: "../functions/appsync-organizer-batch/dist",
  environment: { ORGANIZERS_TABLE: organizersTable.name },
  statements: [{ Action: ["dynamodb:BatchGetItem"], Resource: [organizersTable.arn] }],
});
new aws.iam.RolePolicy("appsync-ds-policy", {
  role: dsRole.name,
  policy: pulumi.jsonStringify({
    Version: "2012-10-17",
    Statement: [
      {
        Effect: "Allow",
        Action: ["dynamodb:GetItem", "dynamodb:Query", "dynamodb:PutItem", "dynamodb:UpdateItem"],
        Resource: [...tableResources(eventsTable)],
      },
      { Effect: "Allow", Action: ["dynamodb:Query"], Resource: [...tableResources(bookingsTable)] },
      { Effect: "Allow", Action: ["lambda:InvokeFunction"], Resource: [organizerBatch.fn.arn] },
    ],
  }),
});

// Data source names: letters, digits and underscores only.
const eventsSource = new aws.appsync.DataSource("events-ds", {
  apiId: graphqlApi.id,
  name: "EventsTable",
  type: "AMAZON_DYNAMODB",
  serviceRoleArn: dsRole.arn,
  dynamodbConfig: { tableName: eventsTable.name },
});
const bookingsSource = new aws.appsync.DataSource("bookings-ds", {
  apiId: graphqlApi.id,
  name: "BookingsTable",
  type: "AMAZON_DYNAMODB",
  serviceRoleArn: dsRole.arn,
  dynamodbConfig: { tableName: bookingsTable.name },
});
// NONE: no backend at all. Used for publishSeatUpdate (just triggers subscriptions) and the admin check.
const noneSource = new aws.appsync.DataSource("none-ds", {
  apiId: graphqlApi.id,
  name: "None",
  type: "NONE",
});
const organizerSource = new aws.appsync.DataSource("organizer-ds", {
  apiId: graphqlApi.id,
  name: "OrganizerBatchLambda",
  type: "AWS_LAMBDA",
  serviceRoleArn: dsRole.arn,
  lambdaConfig: { functionArn: organizerBatch.fn.arn },
});

// Step 5: unit resolvers: one field -> one data source -> one JS file.
const unit = (
  field: string,
  type: string,
  source: aws.appsync.DataSource,
  file: string,
  maxBatchSize?: number,
) =>
  new aws.appsync.Resolver(`${type}-${field}`, {
    apiId: graphqlApi.id,
    type,
    field,
    kind: "UNIT",
    dataSource: source.name,
    runtime,
    code: code(file),
    maxBatchSize,
  });
unit("events", "Query", eventsSource, "query-events");
unit("event", "Query", eventsSource, "query-event");
unit("myBookings", "Query", bookingsSource, "query-my-bookings");
unit("publishSeatUpdate", "Mutation", noneSource, "mutation-publish-seat-update");
// BatchInvoke: up to 20 Event.organizer lookups per Lambda call. Set 0 to watch the N+1 problem come back.
unit("organizer", "Event", organizerSource, "field-event-organizer", 20);

// Step 6: pipeline resolvers: check-admin (NONE) runs first, then the DynamoDB write.
const fn = (name: string, source: aws.appsync.DataSource, file: string) =>
  new aws.appsync.Function(name, {
    apiId: graphqlApi.id,
    name: name.replace(/-/g, "_"),
    dataSource: source.name,
    runtime,
    code: code(file),
  });
const checkAdmin = fn("check-admin", noneSource, "fn-check-admin");
const createEventFn = fn("create-event", eventsSource, "fn-create-event");
const updateEventFn = fn("update-event", eventsSource, "fn-update-event");

for (const [field, write] of [
  ["createEvent", createEventFn],
  ["updateEvent", updateEventFn],
] as const) {
  new aws.appsync.Resolver(`Mutation-${field}`, {
    apiId: graphqlApi.id,
    type: "Mutation",
    field,
    kind: "PIPELINE",
    runtime,
    code: code("pipeline"),
    pipelineConfig: { functions: [checkAdmin.functionId, write.functionId] },
  });
}

// Used by the saga Lambdas (IAM: only this one mutation) and by the web build.
export const graphqlUrl = graphqlApi.uris.apply((u) => u["GRAPHQL"]!);
export const publishSeatUpdateArn = pulumi.interpolate`${graphqlApi.arn}/types/Mutation/fields/publishSeatUpdate`;
