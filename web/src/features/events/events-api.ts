// Fetch functions for events. Plain async functions: React Query calls them, tests can call them too.
import type { Event, EventPage } from "@ticketlite/shared";
import { apiFetch } from "../../lib/api-client";

export function fetchEvents(city: string | undefined, cursor: string | undefined) {
  const params = new URLSearchParams({ limit: "12" });
  if (city) params.set("city", city);
  if (cursor) params.set("cursor", cursor);
  return apiFetch<EventPage>(`/api/events?${params}`);
}

export const fetchEvent = (eventId: string) => apiFetch<Event>(`/api/events/${encodeURIComponent(eventId)}`);
