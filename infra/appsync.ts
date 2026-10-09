// AWS AppSync: the GraphQL API itself (read-heavy browsing + real-time seat updates): schema, auth modes,
// logging and the public API key. Data sources and resolvers are in appsync-resolvers.ts.
// Schema: graphql/schema.graphql. Resolver code: graphql/resolvers/*.ts, bundled to graphql/dist by esbuild.
// CONCEPT: appsync-auth-modes, real-time
import * as fs from "node:fs";
import * as path from "node:path";
import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";
import { userPool } from "./cognito";
import { stage } from "./config";

const graphqlDir = path.join(__dirname, "..", "graphql");
export const code = (name: string) => fs.readFileSync(path.join(graphqlDir, "dist", `${name}.js`), "utf8");
export const runtime = { name: "APPSYNC_JS", runtimeVersion: "1.0.0" };

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

// Used by the saga Lambdas (IAM: only this one mutation) and by the web build.
export const graphqlUrl = graphqlApi.uris.apply((u) => u["GRAPHQL"]!);
export const publishSeatUpdateArn = pulumi.interpolate`${graphqlApi.arn}/types/Mutation/fields/publishSeatUpdate`;
