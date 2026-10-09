// Saga step 3: ConfirmBooking. Marks the booking CONFIRMED, then publishes BookingConfirmed to EventBridge
// (email + admin notification) and the live seat count to AppSync. CONCEPT: saga, idempotency
import { ConditionalCheckFailedException } from "@aws-sdk/client-dynamodb";
import { UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { announceOutcome } from "../shared/announce";
import { ddb, tableName } from "../shared/dynamodb";
import { countMetric, logger } from "../shared/powertools";
import type { SagaInput } from "../shared/saga";

const BOOKINGS_TABLE = tableName("BOOKINGS_TABLE");

// Step 1: only a PENDING booking can be confirmed.
const confirmCommand = (input: SagaInput) =>
  new UpdateCommand({
    TableName: BOOKINGS_TABLE,
    Key: { bookingId: input.bookingId },
    UpdateExpression: "SET #status = :confirmed, paymentId = :paymentId, updatedAt = :now",
    ConditionExpression: "#status = :pending",
    ExpressionAttributeNames: { "#status": "status" },
    ExpressionAttributeValues: {
      ":confirmed": "CONFIRMED",
      ":pending": "PENDING",
      ":paymentId": input.paymentId ?? "unknown",
      ":now": new Date().toISOString(),
    },
  });

export const handler = async (input: SagaInput): Promise<SagaInput> => {
  logger.appendKeys({ correlationId: input.correlationId, bookingId: input.bookingId });

  // If a retry finds the booking already CONFIRMED, the condition fails: that's success.
  try {
    await ddb.send(confirmCommand(input));
  } catch (error) {
    if (!(error instanceof ConditionalCheckFailedException)) throw error;
    logger.info("booking was already confirmed"); // an earlier attempt succeeded
  }

  // Step 2: count it and tell everyone (BookingConfirmed event + live seat count).
  logger.info("booking confirmed");
  countMetric("BookingsConfirmed");
  await announceOutcome("BookingConfirmed", input);
  return input;
};
