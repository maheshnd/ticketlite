// Zod schemas for an Event: the thing users browse and book.
// One schema is the single source of truth: the API validates with it and TypeScript types come from it.
// CONCEPT: schema-validation
import { z } from "zod";
import { PageQuerySchema, pageSchema } from "./pagination";

// Step 1: the full Event as stored in DynamoDB and returned by the API.
export const EventSchema = z.object({
  eventId: z.string().min(1),
  name: z.string().min(3).max(120),
  description: z.string().max(2000),
  city: z.string().min(2).max(60),
  venue: z.string().min(2).max(120),
  startsAt: z.iso.datetime(), // ISO 8601 string, so it also sorts correctly as a DynamoDB sort key
  price: z.number().nonnegative(),
  totalSeats: z.number().int().positive(),
  availableSeats: z.number().int().nonnegative(),
  posterKey: z.string().optional(),
  organizerId: z.string().min(1),
  status: z.enum(["DRAFT", "PUBLISHED"]),
  // CONCEPT: optimistic-locking — every write bumps this number; a stale number means someone else saved first.
  version: z.number().int().nonnegative(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type Event = z.infer<typeof EventSchema>;

// Step 2: what an admin sends to create an event. The server fills in ids, seats left, version and dates.
export const CreateEventInputSchema = EventSchema.pick({
  name: true,
  description: true,
  city: true,
  venue: true,
  startsAt: true,
  price: true,
  totalSeats: true,
  organizerId: true,
  status: true,
});
export type CreateEventInput = z.infer<typeof CreateEventInputSchema>;

// Step 3: an update must say which version it was based on, so the server can detect conflicts.
export const UpdateEventInputSchema = CreateEventInputSchema.partial().extend({
  version: z.number().int().nonnegative(),
});
export type UpdateEventInput = z.infer<typeof UpdateEventInputSchema>;

// Step 4: GET /api/events query string and response. `city` is optional: without it we list every
// published event, soonest first.
export const ListEventsQuerySchema = PageQuerySchema.extend({
  city: z.string().min(2).max(60).optional(),
});
export type ListEventsQuery = z.infer<typeof ListEventsQuerySchema>;

export const EventPageSchema = pageSchema(EventSchema);
export type EventPage = z.infer<typeof EventPageSchema>;
