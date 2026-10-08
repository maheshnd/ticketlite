import type { FastifyInstance } from "fastify";

// Hard-coded for Phase 1. A later phase replaces this array with a DynamoDB query.
const events = [
  { id: "evt-1", name: "Coldplay Live", city: "Mumbai", date: "2026-12-05" },
  { id: "evt-2", name: "Tech Conf India", city: "Bengaluru", date: "2027-01-20" },
  { id: "evt-3", name: "Comedy Night", city: "Pune", date: "2027-02-14" },
];

// GET /events: list all events.
export function eventsRoutes(app: FastifyInstance) {
  app.get("/events", async () => {
    return events;
  });
}
