// Tells the rest of the system how a booking ended, after the saga changed the seat count:
//   1. a domain event on EventBridge (email worker, admin topic, ...)  CONCEPT: event-driven
//   2. the new seat count to AppSync, for everyone watching the event   CONCEPT: real-time
// If PutEvents fails this throws and the state machine retries the step (the steps' writes are idempotent).
import { publishSeatUpdate } from "./appsync";
import { publishEvent } from "./eventbridge";
import { getAvailableSeats } from "./events-table";
import type { SagaInput } from "./saga";

export async function announceOutcome(
  detailType: "BookingConfirmed" | "BookingFailed",
  input: SagaInput,
  extra: Record<string, string> = {},
) {
  const { bookingId, eventId, userId, eventName, seats, amount, correlationId } = input;
  await publishEvent(detailType, {
    bookingId,
    eventId,
    userId,
    eventName,
    seats,
    amount,
    correlationId,
    ...extra,
  });

  const availableSeats = await getAvailableSeats(eventId);
  if (availableSeats !== undefined) await publishSeatUpdate(eventId, availableSeats);
}
