// Zod schemas for bookings. A booking starts PENDING; the Step Functions saga moves it to CONFIRMED or FAILED.
import { z } from "zod";
import { pageSchema } from "./pagination";

export const BookingStatusSchema = z.enum(["PENDING", "CONFIRMED", "FAILED", "CANCELLED"]);
export type BookingStatus = z.infer<typeof BookingStatusSchema>;

// PENDING is the only status that can still change. The web app polls until it sees one of the others.
export const isFinalStatus = (status: BookingStatus) => status !== "PENDING";

export const BookingSchema = z.object({
  bookingId: z.string(),
  userId: z.string(),
  eventId: z.string(),
  eventName: z.string(), // copied from the event at booking time, so "My bookings" needs no second read
  seats: z.number().int().positive(),
  amount: z.number().nonnegative(),
  status: BookingStatusSchema,
  failureReason: z.string().optional(),
  executionArn: z.string().optional(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type Booking = z.infer<typeof BookingSchema>;

// POST /api/bookings body. Max 6 seats per booking keeps one user from buying out an event.
export const CreateBookingInputSchema = z.object({
  eventId: z.string().min(1).max(64),
  seats: z.number().int().min(1).max(6),
});
export type CreateBookingInput = z.infer<typeof CreateBookingInputSchema>;

// 202 Accepted: the booking exists, the saga is still running.
export const CreateBookingResponseSchema = z.object({ bookingId: z.string(), status: BookingStatusSchema });
export type CreateBookingResponse = z.infer<typeof CreateBookingResponseSchema>;

export const BookingPageSchema = pageSchema(BookingSchema);
export type BookingPage = z.infer<typeof BookingPageSchema>;
