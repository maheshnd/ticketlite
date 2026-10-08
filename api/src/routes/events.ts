// Public event routes: list (cursor pagination, optional city filter) and detail (with ETag / 304).
import { createHash } from "node:crypto";
import { EventPageSchema, EventSchema, ListEventsQuerySchema } from "@ticketlite/shared";
import { z } from "zod";
import { getPublishedEvent, listEvents } from "../services/events-service";
import type { App } from "../types";

const IdParams = z.object({ id: z.string().min(1).max(64) });

// A strong ETag: a short hash of the exact response body. Any change (even one seat sold) changes it.
const etagFor = (body: unknown) =>
  `"${createHash("sha256").update(JSON.stringify(body)).digest("base64url").slice(0, 27)}"`;

export function eventsRoutes(app: App) {
  // GET /api/events?city=Pune&limit=20&cursor=...
  app.get(
    "/events",
    { schema: { querystring: ListEventsQuerySchema, response: { 200: EventPageSchema } } },
    async (request, reply) => {
      // Browsers and CloudFront may reuse this list for 30s: a slightly stale list is fine.
      // CONCEPT: http-caching
      reply.header("cache-control", "public, max-age=30");
      return listEvents(request.query);
    },
  );

  // GET /api/events/:id. The seat count must be fresh, so caches must check back every time
  // (max-age=0, must-revalidate), but an unchanged event costs only a tiny 304 with no body.
  app.get(
    "/events/:id",
    { schema: { params: IdParams, response: { 200: EventSchema, 304: z.void() } } },
    async (request, reply) => {
      const event = await getPublishedEvent(request.params.id);
      const etag = etagFor(event);
      reply.header("etag", etag).header("cache-control", "public, max-age=0, must-revalidate");

      // The browser sends back the ETag it has. Same ETag = it already has this exact version.
      if (request.headers["if-none-match"] === etag) return reply.code(304).send();
      return event;
    },
  );
}
