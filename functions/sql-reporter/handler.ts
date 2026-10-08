// sql-reporter (flag enableSql): copies every booking change from DynamoDB into Aurora PostgreSQL, so admins
// can run SQL reports (JOINs, GROUP BY) that DynamoDB isn't built for. CONCEPT: streams, sql-vs-nosql
// Bookings stream (NEW_IMAGE) -> this Lambda -> RDS Data API (HTTPS, no VPC) -> Aurora.
import { join } from "node:path";
import { unmarshall } from "@aws-sdk/util-dynamodb";
import type { AttributeValue } from "@aws-sdk/client-dynamodb";
import { createDb, isDatabaseResuming, schema } from "@ticketlite/sql";
import type { Booking } from "@ticketlite/shared";
import type { DynamoDBBatchResponse, DynamoDBStreamEvent } from "aws-lambda";
import { migrate } from "drizzle-orm/aws-data-api/pg/migrator";
import { logger } from "../shared/powertools";
import { toRows } from "./rows";

const db = createDb({
  resourceArn: process.env.SQL_CLUSTER_ARN ?? "",
  secretArn: process.env.SQL_SECRET_ARN ?? "",
  database: process.env.SQL_DATABASE ?? "ticketlite",
});

// Step 1: apply pending migrations once per Lambda copy (build.mjs copies them to dist/migrations).
// Drizzle records applied migrations in a table, so this is a no-op after the first run.
let migrated: Promise<void> | undefined;
const ensureMigrated = () =>
  (migrated ??= migrate(db, { migrationsFolder: join(__dirname, "migrations") }).catch((error: unknown) => {
    migrated = undefined; // try again on the next invocation
    throw error;
  }));

export const handler = async (event: DynamoDBStreamEvent): Promise<DynamoDBBatchResponse> => {
  await ensureMigrated(); // throws while the cluster is resuming: the whole batch is retried later

  for (const record of event.Records) {
    const image = record.dynamodb?.NewImage as unknown as Record<string, AttributeValue> | undefined;
    if (!image) continue; // a delete: reports keep history, nothing to do
    try {
      const { event: eventRow, booking } = toRows(unmarshall(image) as Booking);
      // Step 2: UPSERTs ("insert, or update if the key exists"): replaying a record changes nothing.
      // CONCEPT: idempotency
      await db
        .insert(schema.events)
        .values(eventRow)
        .onConflictDoUpdate({ target: schema.events.eventId, set: { name: eventRow.name } });
      await db
        .insert(schema.bookings)
        .values(booking)
        .onConflictDoUpdate({
          target: schema.bookings.bookingId,
          set: { status: booking.status, amount: booking.amount, seats: booking.seats },
        });
    } catch (error) {
      logger.error(isDatabaseResuming(error) ? "database resuming, will retry" : "sql upsert failed", {
        error: error as Error,
      });
      return { batchItemFailures: [{ itemIdentifier: record.dynamodb!.SequenceNumber! }] };
    }
  }
  return { batchItemFailures: [] };
};
