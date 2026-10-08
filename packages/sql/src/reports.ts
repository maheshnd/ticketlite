// The admin reports: aggregations with a JOIN, the kind of question SQL answers in one query and DynamoDB
// doesn't answer well at all. Written with Drizzle's query builder: values are always sent as bound
// parameters, never pasted into the SQL string. CONCEPT: sql-injection
import { count, desc, eq, sql, sum } from "drizzle-orm";
import type { Db } from "./client";
import { bookings, events } from "./schema";

// Revenue and bookings per event (confirmed only), highest revenue first.
export function revenuePerEvent(db: Db) {
  return db
    .select({
      eventId: events.eventId,
      name: events.name,
      bookings: count(bookings.bookingId),
      revenue: sum(bookings.amount),
    })
    .from(bookings)
    .innerJoin(events, eq(bookings.eventId, events.eventId))
    .where(eq(bookings.status, "CONFIRMED"))
    .groupBy(events.eventId, events.name)
    .orderBy(desc(sum(bookings.amount)));
}

// Bookings per day (all statuses), last 30 days.
export function bookingsPerDay(db: Db) {
  const day = sql<string>`to_char(date_trunc('day', ${bookings.createdAt}), 'YYYY-MM-DD')`;
  return db
    .select({ day, bookings: count() })
    .from(bookings)
    .where(sql`${bookings.createdAt} > now() - interval '30 days'`)
    .groupBy(day)
    .orderBy(day);
}
