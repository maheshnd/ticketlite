// MSW request handlers: a fake TicketLite API that runs inside the test process (or, in M7, inside the
// browser via a service worker). Components make real fetch calls; MSW answers them. CONCEPT: api-mocking
import { HttpResponse, http, ws } from "msw";
import { graphql } from "msw/graphql"; // MSW 3 moved GraphQL mocking to its own entry point
import type { Booking, Event } from "@ticketlite/shared";
import { mockEvents } from "./data";

// A booking that is PENDING the first time it is read and CONFIRMED after that, like a fast saga.
const bookingReads = new Map<string, number>();
const mockBooking = (bookingId: string, reads: number): Booking => ({
  bookingId,
  userId: "user-1",
  eventId: "evt-001",
  eventName: "Event 1",
  seats: 2,
  amount: 998,
  status: reads > 1 ? "CONFIRMED" : "PENDING",
  createdAt: "2026-10-08T10:00:00.000Z",
  updatedAt: "2026-10-08T10:00:00.000Z",
});

const PAGE_SIZE = 12;
const problem = (status: number, title: string, detail: string) =>
  HttpResponse.json(
    { type: "about:blank", title, status, detail },
    { status, headers: { "content-type": "application/problem+json" } },
  );

// AppSync real-time: a WebSocket that speaks AppSync's protocol. Tests can push seat updates with
// pushSeatUpdate() below (in the browser mock mode, the mock booking flow does the same).
export const appsyncRealtime = ws.link("wss://*.appsync-realtime-api.*/graphql");
const appsyncGraphql = graphql.link("https://*.appsync-api.*/graphql"); // MSW 3: GraphQL mocks are per endpoint
let pushToClients: ((eventId: string, availableSeats: number) => void) | undefined;
export const pushSeatUpdate = (eventId: string, availableSeats: number) =>
  pushToClients?.(eventId, availableSeats);

export const handlers = [
  appsyncRealtime.addEventListener("connection", ({ client }) => {
    const subscriptions = new Map<string, string>(); // subscription id -> eventId
    pushToClients = (eventId, availableSeats) => {
      for (const [id, subscribedEventId] of subscriptions) {
        if (subscribedEventId !== eventId) continue;
        const onSeatUpdate = { eventId, availableSeats, updatedAt: new Date().toISOString() };
        client.send(JSON.stringify({ id, type: "data", payload: { data: { onSeatUpdate } } }));
      }
    };
    client.addEventListener("message", (event) => {
      const message = JSON.parse(String(event.data)) as {
        type: string;
        id: string;
        payload: { data: string };
      };
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

  // AppSync GraphQL over HTTP (MSW parses the operation name from the query).
  appsyncGraphql.query("EventOrganizer", ({ variables }) =>
    HttpResponse.json({
      data: { event: { eventId: variables.id, organizer: { name: "Live Nation India" } } },
    }),
  ),

  // Cursor pagination, like the real API: the cursor here is simply the next index.
  http.get("*/api/events", ({ request }) => {
    const url = new URL(request.url);
    const city = url.searchParams.get("city");
    const start = Number(url.searchParams.get("cursor") ?? 0);
    const matching = mockEvents.filter((e) => !city || e.city === city);
    const items = matching.slice(start, start + PAGE_SIZE);
    const next = start + PAGE_SIZE < matching.length ? String(start + PAGE_SIZE) : null;
    return HttpResponse.json({ items, nextCursor: next });
  }),

  // Search: case-insensitive word match + a city aggregation, like the API's DynamoDB fallback.
  http.get("*/api/search", ({ request }) => {
    const url = new URL(request.url);
    const q = (url.searchParams.get("q") ?? "").toLowerCase();
    const city = url.searchParams.get("city");
    const matching = mockEvents.filter((e) => e.name.toLowerCase().includes(q));
    const counts = new Map<string, number>();
    for (const e of matching) counts.set(e.city, (counts.get(e.city) ?? 0) + 1);
    const items = matching.filter((e) => !city || e.city === city);
    return HttpResponse.json({
      items,
      total: items.length,
      cities: [...counts].map(([c, count]) => ({ city: c, count })),
      source: "dynamodb-fallback",
    });
  }),

  http.get("*/api/events/:id", ({ params }) => {
    const event = mockEvents.find((e) => e.eventId === params.id);
    return event ? HttpResponse.json(event) : problem(404, "Not Found", `Event ${params.id} does not exist.`);
  }),

  // One known user: test@ticketlite.dev / Tickets2026x
  http.post("*/api/auth/login", async ({ request }) => {
    const body = (await request.json()) as { email: string; password: string };
    return body.password === "Tickets2026x"
      ? HttpResponse.json({ accessToken: "mock-access-token", expiresIn: 900 })
      : problem(401, "Unauthorized", "Wrong email or password, or the session has ended. Log in again.");
  }),

  // No refresh cookie in tests: the user starts logged out.
  http.post("*/api/auth/refresh", () => problem(401, "Unauthorized", "Not logged in.")),
  http.post("*/api/auth/logout", () => new HttpResponse(null, { status: 204 })),
  http.post("*/api/auth/signup", () => HttpResponse.json({ confirmed: false }, { status: 201 })),

  // The logged-in mock user is an admin, so the admin pages can be exercised too.
  http.get("*/api/me", () =>
    HttpResponse.json({ userId: "user-1", email: "test@ticketlite.dev", groups: ["admin"] }),
  ),

  http.post("*/api/bookings", ({ request }) =>
    request.headers.get("idempotency-key")
      ? HttpResponse.json({ bookingId: "bk-1", status: "PENDING" }, { status: 202 })
      : problem(400, "Bad Request", "Send an Idempotency-Key header"),
  ),
  http.get("*/api/bookings/:id", ({ params }) => {
    const id = String(params.id);
    const reads = (bookingReads.get(id) ?? 0) + 1;
    bookingReads.set(id, reads);
    return HttpResponse.json(mockBooking(id, reads));
  }),
  http.get("*/api/bookings", () => HttpResponse.json({ items: [mockBooking("bk-1", 2)], nextCursor: null })),

  http.get("*/api/admin/events", () => HttpResponse.json({ items: mockEvents.slice(0, 3) })),
  http.put("*/api/admin/events/:id", async ({ params, request }) => {
    const body = (await request.json()) as Partial<Event> & { version: number };
    const event = mockEvents.find((e) => e.eventId === params.id)!;
    return HttpResponse.json({ ...event, ...body, version: body.version + 1 });
  }),
];
