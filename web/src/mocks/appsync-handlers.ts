// Fake AppSync: GraphQL queries over HTTP, and the real-time WebSocket protocol (connection_init ->
// connection_ack, start -> start_ack, then "data" messages). pushSeatUpdate() sends a seat update to every
// client subscribed to that event, like the saga's publishSeatUpdate does in AWS. CONCEPT: api-mocking
import { HttpResponse, ws } from "msw";
import { graphql } from "msw/graphql"; // MSW 3 moved GraphQL mocking to its own entry point

const appsyncRealtime = ws.link("wss://*.appsync-realtime-api.*/graphql");
const appsyncGraphql = graphql.link("https://*.appsync-api.*/graphql"); // MSW 3: GraphQL mocks are per endpoint

let pushToClients: ((eventId: string, availableSeats: number) => void) | undefined;
export const pushSeatUpdate = (eventId: string, availableSeats: number) =>
  pushToClients?.(eventId, availableSeats);

type ClientMessage = { type: string; id: string; payload: { data: string } };

export const appsyncHandlers = [
  appsyncRealtime.addEventListener("connection", ({ client }) => {
    const subscriptions = new Map<string, string>(); // subscription id -> eventId

    // Server -> client: one "data" message per matching subscription.
    pushToClients = (eventId, availableSeats) => {
      const onSeatUpdate = { eventId, availableSeats, updatedAt: new Date().toISOString() };
      for (const [id, subscribedEventId] of subscriptions) {
        if (subscribedEventId === eventId)
          client.send(JSON.stringify({ id, type: "data", payload: { data: { onSeatUpdate } } }));
      }
    };

    // Client -> server: acknowledge the connection and each subscription.
    client.addEventListener("message", (event) => {
      const message = JSON.parse(String(event.data)) as ClientMessage;
      if (message.type === "connection_init") {
        client.send(JSON.stringify({ type: "connection_ack", payload: { connectionTimeoutMs: 300000 } }));
      }
      if (message.type === "start") {
        const { variables } = JSON.parse(message.payload.data) as { variables: { eventId: string } };
        subscriptions.set(message.id, variables.eventId);
        client.send(JSON.stringify({ id: message.id, type: "start_ack" }));
      }
    });
  }),

  // MSW reads the operation name ("EventOrganizer") from the query.
  appsyncGraphql.query("EventOrganizer", ({ variables }) =>
    HttpResponse.json({
      data: { event: { eventId: variables.id, organizer: { name: "Live Nation India" } } },
    }),
  ),
];
