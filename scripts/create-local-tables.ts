// Creates the DynamoDB tables in DynamoDB Local (docker-compose), with the same keys and indexes as
// infra/dynamodb.ts. Only for local development: in AWS, Pulumi creates the tables.
//   docker compose up -d dynamodb
//   DYNAMODB_ENDPOINT=http://localhost:8000 pnpm tsx scripts/create-local-tables.ts
// Keep this file in sync with infra/dynamodb.ts when a table or index changes.
import {
  CreateTableCommand,
  type CreateTableCommandInput,
  ListTablesCommand,
} from "@aws-sdk/client-dynamodb";
import { client } from "./dynamodb-client";

if (!process.env.DYNAMODB_ENDPOINT)
  throw new Error("Set DYNAMODB_ENDPOINT: this script is for DynamoDB Local only.");

// Step 1: small helpers so each table below reads like infra/dynamodb.ts.
const str = (name: string) => ({ AttributeName: name, AttributeType: "S" as const });
const key = (hash: string, range?: string) => [
  { AttributeName: hash, KeyType: "HASH" as const },
  ...(range ? [{ AttributeName: range, KeyType: "RANGE" as const }] : []),
];
const gsi = (IndexName: string, hash: string, range: string) => ({
  IndexName,
  KeySchema: key(hash, range),
  Projection: { ProjectionType: "ALL" as const },
});

// Step 2: the tables (names match the api's local defaults in api/src/config.ts).
const tables: CreateTableCommandInput[] = [
  {
    TableName: "Events",
    KeySchema: key("eventId"),
    AttributeDefinitions: [str("eventId"), str("city"), str("status"), str("startsAt")],
    GlobalSecondaryIndexes: [gsi("byCity", "city", "startsAt"), gsi("byStatus", "status", "startsAt")],
  },
  {
    TableName: "Bookings",
    KeySchema: key("bookingId"),
    AttributeDefinitions: [str("bookingId"), str("userId"), str("eventId"), str("createdAt")],
    GlobalSecondaryIndexes: [gsi("byUser", "userId", "createdAt"), gsi("byEvent", "eventId", "createdAt")],
  },
  { TableName: "IdempotencyKeys", KeySchema: key("key"), AttributeDefinitions: [str("key")] },
  { TableName: "Sessions", KeySchema: key("sessionId"), AttributeDefinitions: [str("sessionId")] },
  { TableName: "Organizers", KeySchema: key("organizerId"), AttributeDefinitions: [str("organizerId")] },
];

// Step 3: create the ones that don't exist yet, so the script can be run again safely.
const existing = new Set((await client.send(new ListTablesCommand({}))).TableNames ?? []);
for (const table of tables) {
  if (existing.has(table.TableName!)) {
    console.log(`exists   ${table.TableName}`);
    continue;
  }
  await client.send(new CreateTableCommand({ ...table, BillingMode: "PAY_PER_REQUEST" }));
  console.log(`created  ${table.TableName}`);
}
