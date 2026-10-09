// pnpm dev: starts the whole app locally with one command. Ctrl+C stops it.
//   1. docker compose up -d: Redis, OpenSearch and DynamoDB Local
//   2. OFFLINE mode (no api/.env.local): create the tables in DynamoDB Local and add the sample events
//      CONNECTED mode (api/.env.local exists, written by `pnpm dev:env`): the API uses the deployed AWS stack
//   3. the API (http://localhost:3000) and the web app (http://localhost:3001) side by side
import { execSync, spawn } from "node:child_process";
import { existsSync } from "node:fs";

const connected = existsSync("api/.env.local");
const DYNAMODB_LOCAL = "http://localhost:8000";
const run = (command: string, env: NodeJS.ProcessEnv = process.env) =>
  execSync(command, { stdio: "inherit", env });

// DynamoDB Local takes a few seconds to accept requests after its container starts.
async function waitForDynamoDbLocal() {
  for (let attempt = 0; attempt < 30; attempt++) {
    const reachable = await fetch(DYNAMODB_LOCAL).then(
      () => true,
      () => false,
    );
    if (reachable) return;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`DynamoDB Local did not start at ${DYNAMODB_LOCAL}`);
}

// Step 1: the containers (REDIS_PORT=6380 pnpm dev if port 6379 is taken).
run("docker compose up -d");

// Step 2: offline data. DynamoDB Local runs in memory, so the tables are created on every start.
const offlineEnv = { ...process.env, DYNAMODB_ENDPOINT: DYNAMODB_LOCAL };
if (connected) {
  console.log(
    "CONNECTED mode: the API uses the deployed dev stack (api/.env.local). Delete it for offline mode.",
  );
} else {
  console.log(
    "OFFLINE mode: DynamoDB Local with sample events. Run `pnpm dev:env` to use the deployed stack.",
  );
  await waitForDynamoDbLocal();
  run("pnpm tsx scripts/create-local-tables.ts", offlineEnv);
  run("pnpm tsx scripts/seed.ts", offlineEnv);
}

// Step 3: the API and the web app together. pnpm prefixes each line with the package name.
// A real environment variable beats the env files, so offline mode can't accidentally reach AWS tables.
const apps = spawn(
  "pnpm",
  ["--parallel", "--filter", "@ticketlite/api", "--filter", "@ticketlite/web", "dev"],
  {
    stdio: "inherit",
    env: connected ? process.env : offlineEnv,
  },
);
apps.on("exit", (code) => process.exit(code ?? 0));
