// Booking logic: create a PENDING booking and hand it to the Step Functions saga; read bookings back.
// CONCEPT: saga, authentication-vs-authorization
import { randomUUID } from "node:crypto";
import type { Booking, CreateBookingInput, CreateBookingResponse } from "@ticketlite/shared";
import { conflict, notFound } from "../errors";
import { startBookingSaga } from "../lib/stepfunctions";
import {
  getBookingById,
  listBookingsByUser,
  markBookingFailed,
  putBooking,
  setExecutionArn,
} from "../repositories/bookings-repository";
import { getEventById, type Page } from "../repositories/events-repository";

export async function createBooking(
  userId: string,
  input: CreateBookingInput,
  correlationId: string,
): Promise<CreateBookingResponse> {
  // Step 1: a cheap early check, so obvious failures get an instant answer. It is NOT the guarantee:
  // two users could both pass it for the last seat. The saga's conditional transaction is the guarantee.
  const event = await getEventById(input.eventId, { consistent: true });
  if (!event || event.status !== "PUBLISHED") throw notFound(`Event ${input.eventId} does not exist.`);
  if (event.availableSeats < input.seats) throw conflict(`Only ${event.availableSeats} seats left.`);

  // Step 2: the booking starts PENDING. Amounts are in rupees with paise, rounded to 2 decimals.
  const now = new Date().toISOString();
  const booking: Booking = {
    bookingId: randomUUID(),
    userId,
    eventId: event.eventId,
    eventName: event.name,
    seats: input.seats,
    amount: Math.round(event.price * input.seats * 100) / 100,
    status: "PENDING",
    createdAt: now,
    updatedAt: now,
  };
  await putBooking(booking);

  // Step 3: start the saga. The correlation id travels with it, so its logs can be found with the API's.
  try {
    // Exactly the fields the steps need (functions/shared/saga.ts), nothing more.
    const { bookingId, eventId, seats, amount } = booking;
    const sagaInput = { bookingId, eventId, userId, seats, amount, correlationId };
    const executionArn = await startBookingSaga(booking.bookingId, sagaInput);
    await setExecutionArn(booking.bookingId, executionArn);
  } catch (error) {
    await markBookingFailed(booking.bookingId, "CouldNotStart");
    throw error;
  }
  return { bookingId: booking.bookingId, status: "PENDING" };
}

// Ownership check: a booking that isn't yours gets the same 404 as one that doesn't exist, so ids can't be
// probed (this prevents "IDOR", insecure direct object reference).
export async function getMyBooking(userId: string, bookingId: string): Promise<Booking> {
  const booking = await getBookingById(bookingId);
  if (!booking || booking.userId !== userId) throw notFound(`Booking ${bookingId} does not exist.`);
  return booking;
}

export const listMyBookings = (userId: string, limit: number, cursor?: string): Promise<Page<Booking>> =>
  listBookingsByUser(userId, limit, cursor);
