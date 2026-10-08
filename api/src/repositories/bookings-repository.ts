// All DynamoDB access for the Bookings table. CONCEPT: repository-pattern, dynamodb-access-patterns
//
// Access patterns:
//   1. Create a booking .................. PutItem  (condition: the id is new)
//   2. Get one booking by id ............. GetItem  (strongly consistent: the user polls right after creating it)
//   3. My bookings, newest first ......... Query    GSI byUser (PK userId, SK createdAt, ScanIndexForward=false)
//   4. Record the saga's execution ARN ... UpdateItem
//   (Status changes are made by the saga Lambdas, see functions/booking-*.)
import { GetCommand, PutCommand, QueryCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import type { Booking } from "@ticketlite/shared";
import { config } from "../config";
import { ddb } from "../lib/dynamodb";
import { decodeCursor, encodeCursor } from "./cursor";
import type { Page } from "./events-repository";

const TableName = config.tables.bookings;

export async function putBooking(booking: Booking) {
  await ddb.send(
    new PutCommand({ TableName, Item: booking, ConditionExpression: "attribute_not_exists(bookingId)" }),
  );
}

export async function getBookingById(bookingId: string): Promise<Booking | undefined> {
  const result = await ddb.send(new GetCommand({ TableName, Key: { bookingId }, ConsistentRead: true }));
  return result.Item as Booking | undefined;
}

export async function listBookingsByUser(
  userId: string,
  limit: number,
  cursor?: string,
): Promise<Page<Booking>> {
  const result = await ddb.send(
    new QueryCommand({
      TableName,
      IndexName: "byUser",
      KeyConditionExpression: "userId = :userId",
      ExpressionAttributeValues: { ":userId": userId },
      ScanIndexForward: false, // newest first (descending createdAt)
      Limit: limit,
      ExclusiveStartKey: decodeCursor(cursor),
    }),
  );
  return {
    items: (result.Items ?? []) as Booking[],
    nextCursor: encodeCursor(result.LastEvaluatedKey as Record<string, string> | undefined),
  };
}

export async function setExecutionArn(bookingId: string, executionArn: string) {
  await ddb.send(
    new UpdateCommand({
      TableName,
      Key: { bookingId },
      UpdateExpression: "SET executionArn = :arn",
      ExpressionAttributeValues: { ":arn": executionArn },
    }),
  );
}

// Used when the saga could not even start: the booking must not stay PENDING forever.
export async function markBookingFailed(bookingId: string, reason: string) {
  await ddb.send(
    new UpdateCommand({
      TableName,
      Key: { bookingId },
      UpdateExpression: "SET #status = :failed, failureReason = :reason, updatedAt = :now",
      ExpressionAttributeNames: { "#status": "status" },
      ExpressionAttributeValues: { ":failed": "FAILED", ":reason": reason, ":now": new Date().toISOString() },
    }),
  );
}
