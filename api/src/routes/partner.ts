// GET /partner/events: the partner read API. Partners call the separate API Gateway REST API
// (infra/partner-api.ts), which checks their API key and enforces their usage plan (rate + daily quota)
// BEFORE this code runs. Same data as the public list, but metered per partner. CONCEPT: api-keys-usage-plans
import { EventPageSchema, ListEventsQuerySchema } from "@ticketlite/shared";
import { listEvents } from "../services/events-service";
import type { App } from "../types";

export function partnerRoutes(app: App) {
  app.get(
    "/events",
    { schema: { querystring: ListEventsQuerySchema, response: { 200: EventPageSchema } } },
    async (request, reply) => {
      reply.header("cache-control", "no-store"); // per-partner metering: don't let caches answer for us
      return listEvents(request.query);
    },
  );
}
