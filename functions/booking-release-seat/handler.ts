// Saga compensation: ReleaseSeat. Payment failed AFTER the seat was taken, so we undo step 1:
// give the seats back and mark the booking FAILED, in one transaction. CONCEPT: saga, compensation
import { TransactionCanceledException } from "@aws-sdk/client-dynamodb";
import { TransactWriteCommand } from "@aws-sdk/lib-dynamodb";
import { announceOutcome } from "../shared/announce";
import { ddb, tableName } from "../shared/dynamodb";
import { countMetric, logger } from "../shared/powertools";
import type { SagaInput } from "../shared/saga";

const EVENTS_TABLE = tableName("EVENTS_TABLE");
const BOOKINGS_TABLE = tableName("BOOKINGS_TABLE");

// Step 1: seats back + booking FAILED, in ONE transaction.
function releaseSeatTransaction(input: SagaInput, reason: string, now: string) {
  return new TransactWriteCommand({
    TransactItems: [
      {
        Update: {
          TableName: EVENTS_TABLE,
          Key: { eventId: input.eventId },
          UpdateExpression: "SET availableSeats = availableSeats + :seats, updatedAt = :now",
          ExpressionAttributeValues: { ":seats": input.seats, ":now": now },
        },
      },
      {
        // Only a booking that still holds its seats can release them. A retry finds it FAILED
        // already, the transaction is cancelled, and the seats are NOT given back twice.
        Update: {
          TableName: BOOKINGS_TABLE,
          Key: { bookingId: input.bookingId },
          UpdateExpression: "SET #status = :failed, failureReason = :reason, updatedAt = :now",
          ConditionExpression: "#status = :pending AND attribute_exists(seatReservedAt)",
          ExpressionAttributeNames: { "#status": "status" },
          ExpressionAttributeValues: {
            ":failed": "FAILED",
            ":pending": "PENDING",
            ":reason": reason,
            ":now": now,
          },
        },
      },
    ],
  });
}

export const handler = async (input: SagaInput): Promise<SagaInput> => {
  logger.appendKeys({ correlationId: input.correlationId, bookingId: input.bookingId });
  const reason = input.error?.Error ?? "PaymentFailed";

  try {
    await ddb.send(releaseSeatTransaction(input, reason, new Date().toISOString()));
  } catch (error) {
    if (!(error instanceof TransactionCanceledException)) throw error;
    logger.info("seats were already released"); // idempotent: nothing left to undo
    return input;
  }

  // Step 2: count it and tell everyone (BookingFailed event + live seat count).
  logger.info("seats released", { reason });
  countMetric("BookingsFailed");
  await announceOutcome("BookingFailed", input, { reason });
  return input;
};
