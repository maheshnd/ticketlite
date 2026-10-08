import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import { lambdaRole, basicLogsAttachment } from "./iam";

// A fixed name (e.g. "ticketlite-api-dev") so we know the log group name before the function exists.
const functionName = `ticketlite-api-${pulumi.getStack()}`;

// Step 1: create the log group ourselves with 7-day retention.
// If Lambda created it, logs would be kept forever and slowly add to the bill.
const logGroup = new aws.cloudwatch.LogGroup("api-logs", {
  name: `/aws/lambda/${functionName}`,
  retentionInDays: 7,
});

// Step 2: the function itself. The code is the esbuild bundle (run `pnpm build` in api/ first).
export const apiFunction = new aws.lambda.Function(
  "api",
  {
    name: functionName,
    role: lambdaRole.arn,
    runtime: aws.lambda.Runtime.NodeJS24dX,
    architectures: ["arm64"], // Graviton: about 20% cheaper per GB-second than x86
    memorySize: 512, // more memory also means more CPU, so cold starts are faster
    timeout: 10, // seconds. Fail fast instead of paying for hung requests
    handler: "index.handler", // file dist/index.js, export "handler"
    code: new pulumi.asset.FileArchive("../api/dist"), // Pulumi zips this folder
    loggingConfig: {
      logFormat: "Text", // Fastify already writes JSON lines, so Lambda shouldn't wrap them again
      logGroup: logGroup.name, // send logs to the group above, not an auto-created one
    },
  },
  {
    // Why dependsOn? Pulumi only waits for resources whose outputs we use (the role ARN, the log group name).
    // Nothing here uses the policy attachment, so without this Pulumi could create the function first.
    // A request that arrives in that gap runs without permission to write logs, and those logs are lost.
    // Listing both makes Pulumi create them before the function.
    dependsOn: [basicLogsAttachment, logGroup],
  },
);
