// All DynamoDB access for the Events table. CONCEPT: repository-pattern, dynamodb-access-patterns
//
// Access patterns (each one is a single GetItem or Query, never a Scan):
//   1. Get one event by id ............. GetItem  on the table   (PK eventId)
//   2. Published events, soonest first . Query    GSI byStatus   (PK status = "PUBLISHED", SK startsAt)
//   3. Events in a city, soonest first . Query    GSI byCity     (PK city, SK startsAt) + filter on status
//   4. Create / update (admin) ......... added in M3 with conditional writes
//
// Why never Scan in a request path? A Scan reads EVERY item in the table (and bills for every one),
// then filters. Its cost and latency grow with the table, not with the page size:
//   await ddb.send(new ScanCommand({ TableName, FilterExpression: "city = :c" })) // DON'T
import { GetCommand, QueryCommand, type QueryCommandOutput } from "@aws-sdk/lib-dynamodb";
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
export async function listPublishedEvents(limit: number, cursor?: string): Promise<Page<Event>> {
  const result = await ddb.send(
    new QueryCommand({
      TableName,
      IndexName: "byStatus",
      KeyConditionExpression: "#status = :published",
      // "status" is a DynamoDB reserved word, so it needs a placeholder name (#status).
      ExpressionAttributeNames: { "#status": "status" },
      ExpressionAttributeValues: { ":published": "PUBLISHED" },
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

function toPage(result: QueryCommandOutput): Page<Event> {
  return {
    items: (result.Items ?? []) as Event[],
    nextCursor: encodeCursor(result.LastEvaluatedKey as Record<string, string> | undefined),
  };
}
