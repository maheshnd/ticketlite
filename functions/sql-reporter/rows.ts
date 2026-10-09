// Turns a Bookings stream image (a DynamoDB booking) into the two SQL rows the reports need.
// Pure function: easy to test without a database. CONCEPT: normalization
import type { Booking } from "@ticketlite/shared";

export function toRows(booking: Booking) {
  return {
    event: { eventId: booking.eventId, name: booking.eventName },
    booking: {
      bookingId: booking.bookingId,
      eventId: booking.eventId,
      userId: booking.userId,
      seats: booking.seats,
      amount: booking.amount.toFixed(2), // numeric(10,2): send an exact decimal string, never a float
      status: booking.status,
      createdAt: new Date(booking.createdAt),
    },
  };
}
