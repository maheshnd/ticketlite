// The SQL reporting schema (Aurora PostgreSQL), defined with Drizzle ORM. Two NORMALIZED tables: each event
// name is stored once and bookings point at it with a foreign key, so reports JOIN them.
// (DynamoDB stores the event name inside each booking instead: denormalized for fast single reads.)
// CONCEPT: sql-vs-nosql, normalization
import { index, integer, numeric, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const events = pgTable("events", {
  eventId: text("event_id").primaryKey(),
  name: text("name").notNull(),
});

export const bookings = pgTable(
  "bookings",
  {
    bookingId: text("booking_id").primaryKey(),
    eventId: text("event_id")
      .notNull()
      .references(() => events.eventId), // foreign key: a booking can't point at an unknown event
    userId: text("user_id").notNull(),
    seats: integer("seats").notNull(),
    amount: numeric("amount", { precision: 10, scale: 2 }).notNull(), // exact money, never float
    status: text("status").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  },
  // Indexes for the report queries: filter by status, group by day. CONCEPT: indexing
  (t) => [index("bookings_status_idx").on(t.status), index("bookings_created_at_idx").on(t.createdAt)],
);
