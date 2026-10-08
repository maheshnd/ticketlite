// email-worker: sends the booking confirmation email.
// EventBridge rule (BookingConfirmed) -> SQS email-queue -> this Lambda (poll-based, small batches).
// CONCEPT: queues, dlq, partial-batch-response, idempotency
//   - Partial batch response: only the messages that failed go back to the queue, not the whole batch.
//   - After 3 failed receives a message moves to the DLQ (see infra/events.ts).
//   - Idempotent: SQS delivers at least once, so a booking's `emailSentAt` marker stops a second email.
import { ConditionalCheckFailedException } from "@aws-sdk/client-dynamodb";
import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";
import { GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import type { SQSBatchResponse, SQSEvent } from "aws-lambda";
import { ddb, tableName } from "../shared/dynamodb";
import { logger, tracer } from "../shared/powertools";

const ses = tracer.captureAWSv3Client(new SESv2Client({}));
const BOOKINGS_TABLE = tableName("BOOKINGS_TABLE");
// SES sandbox: only verified addresses can receive mail, so every email goes to the verified address.
// Production (out of the sandbox) would look up the user's email in Cognito instead.
const TO = process.env.SES_EMAIL!;

type BookingConfirmed = {
  bookingId: string;
  eventName: string;
  seats: number;
  amount: number;
  correlationId: string;
};

async function sendOnce(detail: BookingConfirmed) {
  // Step 1: already sent? (A retry or a duplicate delivery.) Then there is nothing to do.
  const booking = await ddb.send(
    new GetCommand({ TableName: BOOKINGS_TABLE, Key: { bookingId: detail.bookingId }, ConsistentRead: true }),
  );
  if (booking.Item?.emailSentAt) return logger.info("email already sent", { bookingId: detail.bookingId });

  // Step 2: send.
  await ses.send(
    new SendEmailCommand({
      FromEmailAddress: TO,
      Destination: { ToAddresses: [TO] },
      Content: {
        Simple: {
          Subject: { Data: `Booking confirmed: ${detail.eventName}` },
          Body: {
            Text: {
              Data: `Your ${detail.seats} seat(s) for ${detail.eventName} are confirmed. Total: INR ${detail.amount}.\nBooking ${detail.bookingId}`,
            },
          },
        },
      },
    }),
  );

  // Step 3: mark it. If the Lambda crashes between steps 2 and 3, the retry sends a second email. That
  // window is tiny; true exactly-once delivery isn't possible with email, so we accept "rarely twice".
  await ddb
    .send(
      new UpdateCommand({
        TableName: BOOKINGS_TABLE,
        Key: { bookingId: detail.bookingId },
        UpdateExpression: "SET emailSentAt = :now",
        ConditionExpression: "attribute_not_exists(emailSentAt)",
        ExpressionAttributeValues: { ":now": new Date().toISOString() },
      }),
    )
    .catch((error) => {
      if (!(error instanceof ConditionalCheckFailedException)) throw error;
    });
  logger.info("confirmation email sent", { bookingId: detail.bookingId });
}

export const handler = async (event: SQSEvent): Promise<SQSBatchResponse> => {
  const batchItemFailures: SQSBatchResponse["batchItemFailures"] = [];
  for (const record of event.Records) {
    try {
      // The SQS body is the whole EventBridge event; our data is in `detail`.
      const detail = (JSON.parse(record.body) as { detail: BookingConfirmed }).detail;
      logger.appendKeys({ correlationId: detail.correlationId });
      await sendOnce(detail);
    } catch (error) {
      logger.error("email failed", { error: error as Error, messageId: record.messageId });
      batchItemFailures.push({ itemIdentifier: record.messageId });
    }
  }
  return { batchItemFailures };
};
