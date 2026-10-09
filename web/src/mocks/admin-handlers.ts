// Fake admin API. Edits and new events are SAVED (in memory), like the real API, so a refetch after an
// optimistic update shows the same state. resetAdminState() puts everything back between tests.
import type { CreateEventInput, Event } from "@ticketlite/shared";
import { HttpResponse, http } from "msw";
import { mockEvents } from "./data";
import { problem } from "./problem";

const createdEvents: Event[] = [];
const pristineEvents = structuredClone(mockEvents);
export function resetAdminState() {
  createdEvents.length = 0;
  mockEvents.splice(0, mockEvents.length, ...structuredClone(pristineEvents));
}

function createEvent(input: CreateEventInput): Event {
  const now = new Date().toISOString();
  const eventId = `evt-new-${createdEvents.length + 1}`;
  const event = {
    ...input,
    eventId,
    availableSeats: input.totalSeats,
    version: 1,
    createdAt: now,
    updatedAt: now,
  };
  createdEvents.push(event);
  return event;
}

export const adminHandlers = [
  http.get("*/api/admin/events", () =>
    HttpResponse.json({ items: [...mockEvents.slice(0, 3), ...createdEvents] }),
  ),
  http.post("*/api/admin/events", async ({ request }) =>
    HttpResponse.json(createEvent((await request.json()) as CreateEventInput), { status: 201 }),
  ),
  http.put("*/api/admin/events/:id", async ({ params, request }) => {
    const body = (await request.json()) as Partial<Event> & { version: number };
    const list = createdEvents.some((e) => e.eventId === params.id) ? createdEvents : mockEvents;
    const index = list.findIndex((e) => e.eventId === params.id);
    if (index < 0) return problem(404, "Not Found", `Event ${params.id} does not exist.`);
    list[index] = { ...list[index]!, ...body, version: body.version + 1 };
    return HttpResponse.json(list[index]);
  }),
  http.get("*/api/admin/reports", () =>
    HttpResponse.json({
      revenuePerEvent: [{ eventId: "evt-001", name: "Event 1", bookings: 3, revenue: 2994 }],
      bookingsPerDay: [{ day: "2026-10-08", bookings: 3 }],
    }),
  ),
];
