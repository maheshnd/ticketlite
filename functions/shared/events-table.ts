// Reads an event's current seat count after the saga changed it, so the live update shows the real number.
import { GetCommand } from "@aws-sdk/lib-dynamodb";
import { ddb, tableName } from "./dynamodb";

export async function getAvailableSeats(eventId: string): Promise<number | undefined> {
  const result = await ddb.send(
    new GetCommand({
      TableName: tableName("EVENTS_TABLE"),
      Key: { eventId },
      ProjectionExpression: "availableSeats", // read one attribute, not the whole item
      ConsistentRead: true, // the write we want to report just happened
    }),
  );
  return result.Item?.availableSeats as number | undefined;
}
