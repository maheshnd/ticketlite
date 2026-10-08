// DynamoDB access for the IdempotencyKeys table. CONCEPT: idempotency, ttl
//
// Access patterns:
//   1. Claim a key ...... PutItem (condition: the key doesn't exist yet). Only ONE request can win.
//   2. Read a key ....... GetItem (strongly consistent)
//   3. Store the result . UpdateItem (status COMPLETED + the response)
//   4. Release a key .... DeleteItem (the request failed; the client may retry with the same key)
// Items expire after 24h through DynamoDB TTL on `expiresAt` (epoch seconds).
import { ConditionalCheckFailedException } from "@aws-sdk/client-dynamodb";
import { DeleteCommand, GetCommand, PutCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { config } from "../config";
import { ddb } from "../lib/dynamodb";

const TableName = config.tables.idempotency;
const TTL_SECONDS = 24 * 60 * 60;

export type IdempotencyRecord = {
  key: string;
  status: "IN_PROGRESS" | "COMPLETED";
  requestHash: string;
  responseStatus?: number;
  responseBody?: string;
  expiresAt: number;
};

// Returns true if WE claimed the key, false if someone already holds it.
export async function claimKey(key: string, requestHash: string): Promise<boolean> {
  try {
    await ddb.send(
      new PutCommand({
        TableName,
        Item: {
          key,
          status: "IN_PROGRESS",
          requestHash,
          expiresAt: Math.floor(Date.now() / 1000) + TTL_SECONDS,
        },
        ConditionExpression: "attribute_not_exists(#key)",
        ExpressionAttributeNames: { "#key": "key" }, // "key" is a reserved word
      }),
    );
    return true;
  } catch (error) {
    if (error instanceof ConditionalCheckFailedException) return false;
    throw error;
  }
}

export async function getKey(key: string): Promise<IdempotencyRecord | undefined> {
  const result = await ddb.send(new GetCommand({ TableName, Key: { key }, ConsistentRead: true }));
  return result.Item as IdempotencyRecord | undefined;
}

export async function completeKey(key: string, responseStatus: number, responseBody: unknown) {
  await ddb.send(
    new UpdateCommand({
      TableName,
      Key: { key },
      UpdateExpression: "SET #status = :completed, responseStatus = :code, responseBody = :body",
      ExpressionAttributeNames: { "#status": "status" },
      ExpressionAttributeValues: {
        ":completed": "COMPLETED",
        ":code": responseStatus,
        ":body": JSON.stringify(responseBody),
      },
    }),
  );
}

export async function releaseKey(key: string) {
  await ddb.send(new DeleteCommand({ TableName, Key: { key } }));
}
