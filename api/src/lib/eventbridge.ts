// Publishes domain events from the API to the EventBridge bus (EventCreated). CONCEPT: event-driven
import { EventBridgeClient, PutEventsCommand } from "@aws-sdk/client-eventbridge";
import { config } from "../config";

const client = new EventBridgeClient({ region: config.region });

export async function publishEvent(detailType: "EventCreated", detail: object) {
  if (!config.eventBusName) return; // local: no bus
  const result = await client.send(
    new PutEventsCommand({
      Entries: [
        {
          EventBusName: config.eventBusName,
          Source: "ticketlite.events",
          DetailType: detailType,
          Detail: JSON.stringify(detail),
        },
      ],
    }),
  );
  if (result.FailedEntryCount) throw new Error(`EventBridge rejected ${detailType}`);
}
