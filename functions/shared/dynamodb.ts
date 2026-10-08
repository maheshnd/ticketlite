// DynamoDB document client shared by the functions, created once per Lambda copy and traced by X-Ray.
// CONCEPT: connection-reuse
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { tracer } from "./powertools";

export const ddb = DynamoDBDocumentClient.from(
  tracer.captureAWSv3Client(new DynamoDBClient({ maxAttempts: 3 })),
  {
    marshallOptions: { removeUndefinedValues: true },
  },
);

// Table names come from environment variables set by Pulumi. A missing one fails at cold start, loudly.
export function tableName(envVar: "EVENTS_TABLE" | "BOOKINGS_TABLE"): string {
  const name = process.env[envVar];
  if (!name) throw new Error(`${envVar} is not set`);
  return name;
}
