// Fake booking API. A booking is PENDING the first time it is read and CONFIRMED after that, like a fast
// saga; creating one also pushes a live seat update, like the real saga does.
import type { Booking } from "@ticketlite/shared";
import { HttpResponse, http } from "msw";
import { pushSeatUpdate } from "./appsync-handlers";
import { problem } from "./problem";

const bookingReads = new Map<string, number>();
const mockBooking = (bookingId: string, reads: number): Booking => ({
  bookingId,
  userId: "user-1",
  eventId: "evt-001",
  eventName: "Event 1",
  seats: 2,
  amount: 998,
  status: reads > 1 ? "CONFIRMED" : "PENDING",
  createdAt: "2026-10-08T10:00:00.000Z",
  updatedAt: "2026-10-08T10:00:00.000Z",
});

export const bookingHandlers = [
  http.post("*/api/bookings", ({ request }) => {
    if (!request.headers.get("idempotency-key"))
      return problem(400, "Bad Request", "Send an Idempotency-Key header");
    pushSeatUpdate("evt-001", 38);
    return HttpResponse.json({ bookingId: "bk-1", status: "PENDING" }, { status: 202 });
  }),
  http.get("*/api/bookings/:id", ({ params }) => {
    const id = String(params.id);
    const reads = (bookingReads.get(id) ?? 0) + 1;
    bookingReads.set(id, reads);
    return HttpResponse.json(mockBooking(id, reads));
  }),
  http.get("*/api/bookings", () => HttpResponse.json({ items: [mockBooking("bk-1", 2)], nextCursor: null })),
];
