// Fake public event API: the list (cursor pagination: the cursor is simply the next index), the detail,
// and search (word match + city aggregation, like the API's DynamoDB fallback).
import { HttpResponse, http } from "msw";
import { mockEvents } from "./data";
import { problem } from "./problem";

const PAGE_SIZE = 12;

export const eventHandlers = [
  http.get("*/api/events", ({ request }) => {
    const url = new URL(request.url);
    const city = url.searchParams.get("city");
    const start = Number(url.searchParams.get("cursor") ?? 0);
    const matching = mockEvents.filter((e) => !city || e.city === city);
    const next = start + PAGE_SIZE < matching.length ? String(start + PAGE_SIZE) : null;
    return HttpResponse.json({ items: matching.slice(start, start + PAGE_SIZE), nextCursor: next });
  }),

  http.get("*/api/events/:id", ({ params }) => {
    const event = mockEvents.find((e) => e.eventId === params.id);
    return event ? HttpResponse.json(event) : problem(404, "Not Found", `Event ${params.id} does not exist.`);
  }),

  http.get("*/api/search", ({ request }) => {
    const url = new URL(request.url);
    const q = (url.searchParams.get("q") ?? "").toLowerCase();
    const city = url.searchParams.get("city");
    const matching = mockEvents.filter((e) => e.name.toLowerCase().includes(q));
    const counts = new Map<string, number>();
    for (const e of matching) counts.set(e.city, (counts.get(e.city) ?? 0) + 1);
    const items = matching.filter((e) => !city || e.city === city);
    const cities = [...counts].map(([c, count]) => ({ city: c, count }));
    return HttpResponse.json({ items, total: items.length, cities, source: "dynamodb-fallback" });
  }),
];
