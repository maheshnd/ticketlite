// The DynamoDB client, created ONCE per Lambda copy (module level) and reused by every request.
// Reuse keeps the HTTPS connection to DynamoDB open between invocations. CONCEPT: connection-reuse
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { NodeHttpHandler } from "@smithy/node-http-handler";
import { config } from "../config";

// Step 1: the low-level client.
// Timeouts: each attempt gets 1s to connect and 1.5s to answer, up to 3 attempts. Worst case ~7.5s,
// still under the Lambda's 10s timeout, so we can return a clean error instead of being killed.
// CONCEPT: timeout-chain
const client = new DynamoDBClient({
  region: config.region,
  maxAttempts: 3, // the SDK retries throttling and 5xx errors with exponential backoff + jitter
  requestHandler: new NodeHttpHandler({ connectionTimeout: 1000, requestTimeout: 1500 }),
  // Locally: DynamoDB Local in Docker. It accepts any credentials, so dummy ones avoid needing an AWS login.
  ...(config.dynamodbEndpoint
    ? { endpoint: config.dynamodbEndpoint, credentials: { accessKeyId: "local", secretAccessKey: "local" } }
    : {}),
});

// Step 2: the "document" client converts plain JS objects to DynamoDB's typed format ({ S: "..." }) and back.
export const ddb = DynamoDBDocumentClient.from(client, {
  marshallOptions: { removeUndefinedValues: true }, // optional fields that are undefined are simply left out
});
