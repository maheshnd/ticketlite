// One helper that creates a Node.js Lambda function the same way every time:
// its own log group (7-day retention), its own least-privilege role, arm64, X-Ray tracing and source maps.
// Used by lambdas.ts for the api and every small function, so those files only list what is different.
import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";
import { stage } from "./config";
import { createLambdaRole, type PolicyStatement } from "./iam";

export type NodeFunctionArgs = {
  codeDir: string; // folder with the esbuild bundle (index.js), relative to infra/
  memorySize?: number;
  timeout?: number; // seconds
  environment?: Record<string, pulumi.Input<string>>;
  statements?: PolicyStatement[]; // extra permissions on top of logs + X-Ray
  publish?: boolean; // publish a numbered version on every code change (needed for aliases)
  reservedConcurrency?: number;
};

export function createNodeFunction(name: string, args: NodeFunctionArgs) {
  // A fixed name (e.g. "ticketlite-api-dev") so we know the log group name before the function exists.
  const functionName = `ticketlite-${name}-${stage}`;

  // Step 1: create the log group ourselves with 7-day retention.
  // If Lambda created it, logs would be kept forever and slowly add to the bill. CONCEPT: cost-safety
  const logGroup = new aws.cloudwatch.LogGroup(`${name}-logs`, {
    name: `/aws/lambda/${functionName}`,
    retentionInDays: 7,
  });

  // Step 2: its own role. CONCEPT: least-privilege
  const { role, attachments } = createLambdaRole(name, args.statements);

  // Step 3: the function.
  const fn = new aws.lambda.Function(
    name,
    {
      name: functionName,
      role: role.arn,
      runtime: aws.lambda.Runtime.NodeJS24dX,
      architectures: ["arm64"], // Graviton: about 20% cheaper per GB-second than x86
      memorySize: args.memorySize ?? 512, // more memory also means more CPU, so cold starts are faster
      timeout: args.timeout ?? 10, // fail fast instead of paying for hung requests. CONCEPT: timeout-chain
      handler: "index.handler", // file index.js, export "handler"
      code: new pulumi.asset.FileArchive(args.codeDir), // Pulumi zips this folder
      publish: args.publish ?? false,
      reservedConcurrentExecutions: args.reservedConcurrency ?? -1, // -1 = no reservation
      tracingConfig: { mode: "Active" }, // X-Ray traces for every invocation. CONCEPT: distributed-tracing
      environment: {
        variables: {
          STAGE: stage,
          POWERTOOLS_SERVICE_NAME: name, // Powertools adds it to every log line and trace
          NODE_OPTIONS: "--enable-source-maps", // readable stack traces from the minified bundle
          ...args.environment,
        },
      },
      loggingConfig: {
        logFormat: "JSON", // Lambda's own lines (START/END/REPORT) as JSON too, so Logs Insights can query them
        logGroup: logGroup.name, // send logs to the group above, not an auto-created one
      },
    },
    {
      // Why dependsOn? Pulumi only waits for resources whose outputs we use (the role ARN, the log group name).
      // Nothing here uses the policy attachments, so without this Pulumi could create the function first,
      // and a request arriving in that gap could not write its logs.
      dependsOn: [...attachments, logGroup],
    },
  );

  return { fn, role, logGroup };
}
