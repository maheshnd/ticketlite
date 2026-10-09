// Fake events used by the MSW handlers (component tests and the Playwright mock mode).
import type { Event } from "@ticketlite/shared";

const base = {
  description: "A great night out.",
  venue: "Main Hall",
  price: 499,
  totalSeats: 100,
  availableSeats: 40,
  organizerId: "org-1",
  status: "PUBLISHED" as const,
  version: 1,
  createdAt: "2026-10-01T10:00:00.000Z",
  updatedAt: "2026-10-01T10:00:00.000Z",
};

const cities = ["Pune", "Mumbai", "Bengaluru"];
export const mockEvents: Event[] = Array.from({ length: 15 }, (_, i) => ({
  ...base,
  eventId: `evt-${String(i + 1).padStart(3, "0")}`,
  name: `Event ${i + 1}`,
  city: cities[i % 3]!,
  startsAt: new Date(Date.UTC(2027, 0, i + 1, 18)).toISOString(),
}));
