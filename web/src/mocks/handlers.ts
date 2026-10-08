// MSW request handlers: a fake TicketLite API that runs inside the test process (or, in M7, inside the
// browser via a service worker). Components make real fetch calls; MSW answers them. CONCEPT: api-mocking
import { HttpResponse, http } from "msw";
import { mockEvents } from "./data";

const PAGE_SIZE = 12;
const problem = (status: number, title: string, detail: string) =>
  HttpResponse.json(
    { type: "about:blank", title, status, detail },
    { status, headers: { "content-type": "application/problem+json" } },
  );

export const handlers = [
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
];
