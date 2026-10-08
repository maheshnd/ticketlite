// Publishes a domain event to the custom EventBridge bus ("ticketlite-<stage>").
// Publishers don't know who listens: rules on the bus route each event to its consumers (email queue,
// admin SNS topic, ...). CONCEPT: event-driven, choreography
import { EventBridgeClient, PutEventsCommand } from "@aws-sdk/client-eventbridge";
import { logger, tracer } from "./powertools";

const client = tracer.captureAWSv3Client(new EventBridgeClient({}));

export async function publishEvent(detailType: "BookingConfirmed" | "BookingFailed", detail: object) {
  const busName = process.env.EVENT_BUS_NAME;
  if (!busName) return;
  const result = await client.send(
    new PutEventsCommand({
      Entries: [
        {
          EventBusName: busName,
          Source: "ticketlite.bookings",
          DetailType: detailType,
          Detail: JSON.stringify(detail),
        },
      ],
    }),
  );
  // PutEvents can partly fail without throwing: check FailedEntryCount. Throwing lets the saga retry the step.
  if (result.FailedEntryCount) {
    logger.error("PutEvents failed", { entries: result.Entries });
    throw new Error(`EventBridge rejected ${detailType}`);
  }
}
