// Saga step 3: ConfirmBooking. Marks the booking CONFIRMED.
// Then it publishes BookingConfirmed to EventBridge (email + admin notification) and the live seat count
// to AppSync.
// CONCEPT: saga, idempotency
import { ConditionalCheckFailedException } from "@aws-sdk/client-dynamodb";
import { UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { ddb, tableName } from "../shared/dynamodb";
import { countMetric, logger } from "../shared/powertools";
import { publishSeatUpdate } from "../shared/appsync";
import { publishEvent } from "../shared/eventbridge";
import { getAvailableSeats } from "../shared/events-table";
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
  countMetric("BookingsConfirmed");

  // Domain event: whoever cares (email worker, admin topic) subscribes through EventBridge rules.
  // If PutEvents fails this throws and the state machine retries the step (the update above is idempotent).
  const { bookingId, eventId, userId, eventName, seats, amount, correlationId } = input;
  await publishEvent("BookingConfirmed", {
    bookingId,
    eventId,
    userId,
    eventName,
    seats,
    amount,
    correlationId,
  });

  // Live update for everyone watching this event (AppSync subscription).
  const availableSeats = await getAvailableSeats(input.eventId);
  if (availableSeats !== undefined) await publishSeatUpdate(input.eventId, availableSeats);
  return input;
};
