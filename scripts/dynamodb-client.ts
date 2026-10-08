// The DynamoDB client used by the scripts in this folder.
// Locally (DYNAMODB_ENDPOINT set) it talks to DynamoDB Local in Docker with dummy credentials.
// In the seed workflow it uses the deploy role's temporary credentials from the environment.
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

const endpoint = process.env.DYNAMODB_ENDPOINT;

export const client = new DynamoDBClient({
  region: process.env.AWS_REGION ?? "us-east-1",
  ...(endpoint ? { endpoint, credentials: { accessKeyId: "local", secretAccessKey: "local" } } : {}),
});
export const ddb = DynamoDBDocumentClient.from(client);
