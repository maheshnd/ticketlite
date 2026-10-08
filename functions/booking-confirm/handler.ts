// Saga step 3: ConfirmBooking. Marks the booking CONFIRMED.
// Later milestones add: the live seat update to AppSync (M4) and the BookingConfirmed event (M5).
// CONCEPT: saga, idempotency
import { ConditionalCheckFailedException } from "@aws-sdk/client-dynamodb";
import { UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { ddb, tableName } from "../shared/dynamodb";
import { logger } from "../shared/powertools";
import type { SagaInput } from "../shared/saga";

const BOOKINGS_TABLE = tableName("BOOKINGS_TABLE");

export const handler = async (input: SagaInput): Promise<SagaInput> => {
  logger.appendKeys({ correlationId: input.correlationId, bookingId: input.bookingId });

  // Only a PENDING booking can be confirmed. If a retry finds it already CONFIRMED, that's success.
  try {
    await ddb.send(
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
      }),
    );
  } catch (error) {
    if (!(error instanceof ConditionalCheckFailedException)) throw error;
    logger.info("booking was already confirmed"); // an earlier attempt succeeded
  }

  logger.info("booking confirmed");
  return input;
};
