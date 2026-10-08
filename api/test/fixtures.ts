// Sample data shared by the api tests.
import type { Event } from "@ticketlite/shared";

export const sampleEvent: Event = {
  eventId: "evt-1",
  name: "Comedy Night",
  description: "Stand-up in Pune",
  city: "Pune",
  venue: "Hard Rock Cafe",
  startsAt: "2027-02-14T19:30:00.000Z",
  price: 499,
  totalSeats: 100,
  availableSeats: 42,
  organizerId: "org-1",
  status: "PUBLISHED",
  version: 1,
  createdAt: "2026-10-01T10:00:00.000Z",
  updatedAt: "2026-10-01T10:00:00.000Z",
};
