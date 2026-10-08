// Booking routes (all need a logged-in user).
//   POST /api/bookings      -> 202 Accepted + bookingId. The saga runs in the background; the web app polls.
//   GET  /api/bookings/:id  -> one of MY bookings (polled until CONFIRMED or FAILED)
//   GET  /api/bookings      -> my bookings, newest first, cursor pagination
import {
  BookingPageSchema,
  BookingSchema,
  CreateBookingInputSchema,
  CreateBookingResponseSchema,
  PageQuerySchema,
} from "@ticketlite/shared";
import { z } from "zod";
import { currentUser, requireUser } from "../plugins/auth-context";
import { createBooking, getMyBooking, listMyBookings } from "../services/bookings-service";
import { withIdempotency } from "../services/idempotency-service";
import type { App } from "../types";

// The client generates one random key per "Book" click and reuses it for retries of that click.
const IdempotencyHeaders = z.object({
  "idempotency-key": z.string().regex(/^[A-Za-z0-9-]{8,64}$/, "Send an Idempotency-Key header (e.g. a UUID)"),
});

export function bookingRoutes(app: App) {
  app.post(
    "/bookings",
    {
      preHandler: requireUser,
      schema: {
        headers: IdempotencyHeaders,
        body: CreateBookingInputSchema,
        response: { 202: CreateBookingResponseSchema },
      },
    },
    async (request, reply) => {
      const user = currentUser(request);
      const result = await withIdempotency(
        user.userId,
        request.headers["idempotency-key"],
        request.body,
        async () => ({
          status: 202,
          body: await createBooking(user.userId, request.body, request.id),
        }),
      );

      // 202 = "accepted, not finished". Location tells the client where to poll. CONCEPT: http-semantics
      reply.header("location", `/api/bookings/${result.body.bookingId}`);
      if (result.replayed) reply.header("idempotent-replayed", "true");
      return reply.code(202).send(result.body);
    },
  );

  app.get(
    "/bookings/:id",
    {
      preHandler: requireUser,
      schema: { params: z.object({ id: z.string().min(1).max(64) }), response: { 200: BookingSchema } },
    },
    async (request, reply) => {
      reply.header("cache-control", "private, no-store");
      return getMyBooking(currentUser(request).userId, request.params.id);
    },
  );

  app.get(
    "/bookings",
    {
      preHandler: requireUser,
      schema: { querystring: PageQuerySchema, response: { 200: BookingPageSchema } },
    },
    async (request, reply) => {
      reply.header("cache-control", "private, no-store");
      return listMyBookings(currentUser(request).userId, request.query.limit, request.query.cursor);
    },
  );
}
