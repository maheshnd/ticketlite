// GET /api/events: list events.
// Still a hard-coded list in M1. M2 replaces it with a DynamoDB query through a service + repository.
import type { App } from "../types";

const events = [
  { eventId: "evt-1", name: "Coldplay Live", city: "Mumbai", startsAt: "2026-12-05T19:00:00Z" },
  { eventId: "evt-2", name: "Tech Conf India", city: "Bengaluru", startsAt: "2027-01-20T09:00:00Z" },
  { eventId: "evt-3", name: "Comedy Night", city: "Pune", startsAt: "2027-02-14T19:30:00Z" },
];

export function eventsRoutes(app: App) {
  app.get("/events", async () => {
    return { items: events, nextCursor: null };
  });
}
