// The Lambda functions. M1 has only the api ("Lambdalith": one Fastify app serving every REST route).
// Later milestones add the small single-job functions (saga steps, workers, indexers) here.
import * as aws from "@pulumi/aws";
import { flags } from "./config";
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
