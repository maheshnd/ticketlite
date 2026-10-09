// Saga step 1: ReserveSeat. Takes seats from the event AND marks the booking "seat reserved", atomically.
// CONCEPT: saga, transactions, conditional-writes, idempotency
import { TransactionCanceledException } from "@aws-sdk/client-dynamodb";
import { TransactWriteCommand } from "@aws-sdk/lib-dynamodb";
import { ddb, tableName } from "../shared/dynamodb";
import { logger } from "../shared/powertools";
import { SagaError, type SagaInput } from "../shared/saga";

const EVENTS_TABLE = tableName("EVENTS_TABLE");
const BOOKINGS_TABLE = tableName("BOOKINGS_TABLE");

// Step 1: ONE transaction with two conditional updates. Both happen, or neither does.
function reserveSeatTransaction(input: SagaInput, now: string) {
  return new TransactWriteCommand({
    TransactItems: [
      {
        // The seat count can never go below 0: the condition is checked by DynamoDB itself, so two
        // users racing for the last seat can't both win. No locks, no read-then-write gap.
        Update: {
          TableName: EVENTS_TABLE,
          Key: { eventId: input.eventId },
          UpdateExpression: "SET availableSeats = availableSeats - :seats, updatedAt = :now",
          ConditionExpression: "availableSeats >= :seats AND #status = :published",
          ExpressionAttributeNames: { "#status": "status" },
          ExpressionAttributeValues: { ":seats": input.seats, ":now": now, ":published": "PUBLISHED" },
        },
      },
      {
        // Mark the booking. The condition makes a RETRY of this step harmless: the second attempt
        // finds seatReservedAt already set and the whole transaction is cancelled (no double booking).
        Update: {
          TableName: BOOKINGS_TABLE,
          Key: { bookingId: input.bookingId },
          UpdateExpression: "SET seatReservedAt = :now, updatedAt = :now",
          ConditionExpression: "attribute_not_exists(seatReservedAt) AND #status = :pending",
          ExpressionAttributeNames: { "#status": "status" },
          ExpressionAttributeValues: { ":now": now, ":pending": "PENDING" },
        },
      },
    ],
  });
}

// Step 2: a cancelled transaction says WHICH condition failed, one reason per item, in the same order.
//   booking condition failed -> an earlier attempt already reserved the seats: success (idempotent)
//   event condition failed   -> sold out (a business error the state machine catches, never retries)
//   anything else            -> rethrow, and Step Functions retries the step
function handleFailure(error: unknown, input: SagaInput): SagaInput {
  if (!(error instanceof TransactionCanceledException)) throw error;
  const [eventReason, bookingReason] = error.CancellationReasons ?? [];
  if (bookingReason?.Code === "ConditionalCheckFailed") {
    logger.info("seat already reserved by an earlier attempt");
    return input;
  }
  if (eventReason?.Code === "ConditionalCheckFailed") {
    throw new SagaError("SoldOut", "Not enough seats left, or the event is not published.");
  }
  throw error;
}

export const handler = async (input: SagaInput): Promise<SagaInput> => {
  logger.appendKeys({ correlationId: input.correlationId, bookingId: input.bookingId });
  try {
    await ddb.send(reserveSeatTransaction(input, new Date().toISOString()));
  } catch (error) {
    return handleFailure(error, input);
  }
  logger.info("seat reserved", { seats: input.seats });
  return input;
};
