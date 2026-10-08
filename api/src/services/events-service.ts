// Business logic for reading events. Routes call this; this calls the repository.
// No HTTP and no AWS SDK here, which keeps it easy to read and to test.
import type { Event, EventPage, ListEventsQuery } from "@ticketlite/shared";
import { notFound } from "../errors";
import { getEventById, listEventsByCity, listPublishedEvents } from "../repositories/events-repository";

// With a city: the byCity index. Without: every published event (byStatus index).
export async function listEvents(query: ListEventsQuery): Promise<EventPage> {
  return query.city
    ? listEventsByCity(query.city, query.limit, query.cursor)
    : listPublishedEvents(query.limit, query.cursor);
}

// Drafts are invisible to the public: a draft id gets the same 404 as an unknown id,
// so nobody can probe which drafts exist.
export async function getPublishedEvent(eventId: string): Promise<Event> {
  const event = await getEventById(eventId);
  if (!event || event.status !== "PUBLISHED") throw notFound(`Event ${eventId} does not exist.`);
  return event;
}
