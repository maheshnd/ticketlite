// Admin event logic: create, read for editing, update with optimistic locking, list all (incl. drafts).
// CONCEPT: optimistic-locking
import { randomUUID } from "node:crypto";
import type { CreateEventInput, Event, UpdateEventInput } from "@ticketlite/shared";
import { badRequest, conflict, notFound } from "../errors";
import { publishEvent } from "../lib/eventbridge";
import {
  getEventById,
  listEventsByStatus,
  putNewEvent,
  updateEventVersioned,
} from "../repositories/events-repository";
import { invalidateEvent } from "./event-cache";

export async function createEvent(input: CreateEventInput): Promise<Event> {
  const now = new Date().toISOString();
  const event: Event = {
    ...input,
    eventId: `evt-${randomUUID()}`,
    availableSeats: input.totalSeats,
    version: 1,
    createdAt: now,
    updatedAt: now,
  };
  await putNewEvent(event);
  // Domain event for anyone interested (no consumer yet; see infra/events.ts). Best effort: the event
  // exists either way, so a failed publish is logged, not returned to the admin as an error.
  await publishEvent("EventCreated", { eventId: event.eventId, name: event.name, city: event.city }).catch(
    (error) => console.warn(JSON.stringify({ msg: "EventCreated not published", error: String(error) })),
  );
  return event;
}

// Strongly consistent: the edit form must start from the latest `version`, or the first save always fails.
export async function getEventForEdit(eventId: string): Promise<Event> {
  const event = await getEventById(eventId, { consistent: true });
  if (!event) throw notFound(`Event ${eventId} does not exist.`);
  return event;
}

export async function updateEvent(eventId: string, input: UpdateEventInput): Promise<Event> {
  const { version, ...changes } = input;
  const current = await getEventForEdit(eventId);

  // Step 1: changing totalSeats moves availableSeats by the same amount (5 more seats = 5 more to sell).
  const seatDelta = changes.totalSeats !== undefined ? changes.totalSeats - current.totalSeats : 0;
  if (current.availableSeats + seatDelta < 0) {
    throw badRequest(
      `${current.totalSeats - current.availableSeats} seats are already sold; totalSeats can't go below that.`,
    );
  }

  // Step 2: the conditional write. `false` = someone saved since this admin loaded the form.
  const updated = await updateEventVersioned(eventId, version, changes, seatDelta);
  if (!updated)
    throw conflict("Someone else changed this event after you opened it. Reload to see their changes.");
  await invalidateEvent(eventId); // the cached copy is now wrong. CONCEPT: cache-invalidation
  return updated;
}

// Admin list: drafts and published events, soonest first. Two small Queries, no Scan.
export async function listAllEvents(): Promise<Event[]> {
  const [published, drafts] = await Promise.all([
    listEventsByStatus("PUBLISHED", 50),
    listEventsByStatus("DRAFT", 50),
  ]);
  return [...published.items, ...drafts.items].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}
