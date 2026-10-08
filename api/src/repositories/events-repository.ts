// All DynamoDB access for the Events table. CONCEPT: repository-pattern, dynamodb-access-patterns
//
// Access patterns (each one is a single GetItem or Query, never a Scan):
//   1. Get one event by id ............. GetItem  on the table   (PK eventId)
//   2. Events by status, soonest first . Query    GSI byStatus   (PK status, SK startsAt): PUBLISHED for the
//                                                                  public list, DRAFT too for the admin list
//   3. Events in a city, soonest first . Query    GSI byCity     (PK city, SK startsAt) + filter on status
//   4. Create an event (admin) ......... PutItem  (condition: the id is new)
//   5. Update an event (admin) ......... UpdateItem (condition: version unchanged = optimistic locking)
//
// Why never Scan in a request path? A Scan reads EVERY item in the table (and bills for every one),
// then filters. Its cost and latency grow with the table, not with the page size:
//   await ddb.send(new ScanCommand({ TableName, FilterExpression: "city = :c" })) // DON'T
import { ConditionalCheckFailedException } from "@aws-sdk/client-dynamodb";
import {
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
  type QueryCommandOutput,
} from "@aws-sdk/lib-dynamodb";
import type { Event } from "@ticketlite/shared";
import { config } from "../config";
import { ddb } from "../lib/dynamodb";
import { decodeCursor, encodeCursor } from "./cursor";

const TableName = config.tables.events;

export type Page<T> = { items: T[]; nextCursor: string | null };

// Pattern 1. `consistent` chooses the read type. CONCEPT: read-consistency
//   - eventually consistent (default): half the cost; may miss a write from the last ~second.
//     Fine for a public event page.
//   - strongly consistent: always sees the latest write. Used by the admin edit form (M3), which must
//     load the current `version` before saving. Only the table supports it; GSIs are always eventual.
export async function getEventById(eventId: string, { consistent = false } = {}): Promise<Event | undefined> {
  const result = await ddb.send(new GetCommand({ TableName, Key: { eventId }, ConsistentRead: consistent }));
  return result.Item as Event | undefined;
}

// Pattern 2.
export async function listEventsByStatus(
  status: Event["status"],
  limit: number,
  cursor?: string,
): Promise<Page<Event>> {
  const result = await ddb.send(
    new QueryCommand({
      TableName,
      IndexName: "byStatus",
      KeyConditionExpression: "#status = :status",
      // "status" is a DynamoDB reserved word, so it needs a placeholder name (#status).
      ExpressionAttributeNames: { "#status": "status" },
      ExpressionAttributeValues: { ":status": status },
      Limit: limit,
      ExclusiveStartKey: decodeCursor(cursor),
    }),
  );
  return toPage(result);
}

// Pattern 3. Gotcha: DynamoDB applies Limit BEFORE the filter, so a page can hold fewer than `limit`
// items (drafts were read, paid for, then dropped) while a next page still exists.
export async function listEventsByCity(city: string, limit: number, cursor?: string): Promise<Page<Event>> {
  const result = await ddb.send(
    new QueryCommand({
      TableName,
      IndexName: "byCity",
      KeyConditionExpression: "city = :city",
      FilterExpression: "#status = :published",
      ExpressionAttributeNames: { "#status": "status" },
      ExpressionAttributeValues: { ":city": city, ":published": "PUBLISHED" },
      Limit: limit,
      ExclusiveStartKey: decodeCursor(cursor),
    }),
  );
  return toPage(result);
}

// Pattern 4.
export async function putNewEvent(event: Event) {
  await ddb.send(
    new PutCommand({ TableName, Item: event, ConditionExpression: "attribute_not_exists(eventId)" }),
  );
}

// Pattern 5. CONCEPT: optimistic-locking
// The update only happens if `version` is still the one the admin loaded. If someone saved in between, the
// condition fails and we return false (the route answers 409). No locks are held while the admin types.
// `seatDelta` changes availableSeats RELATIVE to its current value, so seats sold by bookings at the same
// moment are never overwritten; `minAvailable` stops a cut in totalSeats from going below seats already sold.
export async function updateEventVersioned(
  eventId: string,
  expectedVersion: number,
  changes: Partial<Event>,
  seatDelta: number,
): Promise<Event | false> {
  const names: Record<string, string> = { "#version": "version" };
  const values: Record<string, unknown> = {
    ":expected": expectedVersion,
    ":one": 1,
    ":delta": seatDelta,
    ":minAvailable": Math.max(0, -seatDelta),
    ":now": new Date().toISOString(),
  };
  const sets = ["#version = #version + :one", "availableSeats = availableSeats + :delta", "updatedAt = :now"];
  for (const [field, value] of Object.entries(changes)) {
    names[`#${field}`] = field; // placeholders avoid clashes with reserved words like "name" and "status"
    values[`:${field}`] = value;
    sets.push(`#${field} = :${field}`);
  }
  try {
    const result = await ddb.send(
      new UpdateCommand({
        TableName,
        Key: { eventId },
        UpdateExpression: `SET ${sets.join(", ")}`,
        ConditionExpression: "#version = :expected AND availableSeats >= :minAvailable",
        ExpressionAttributeNames: names,
        ExpressionAttributeValues: values,
        ReturnValues: "ALL_NEW",
      }),
    );
    return result.Attributes as Event;
  } catch (error) {
    if (error instanceof ConditionalCheckFailedException) return false;
    throw error;
  }
}

function toPage(result: QueryCommandOutput): Page<Event> {
  return {
    items: (result.Items ?? []) as Event[],
    nextCursor: encodeCursor(result.LastEvaluatedKey as Record<string, string> | undefined),
  };
}
