// GET /api/search?q=jazz&city=Pune: full-text search (OpenSearch, or a DynamoDB fallback when disabled).
import { SearchQuerySchema, SearchResponseSchema } from "@ticketlite/shared";
import { searchEvents } from "../services/search-service";
import type { App } from "../types";

export function searchRoutes(app: App) {
  app.get(
    "/search",
    { schema: { querystring: SearchQuerySchema, response: { 200: SearchResponseSchema } } },
    async (request, reply) => {
      reply.header("cache-control", "public, max-age=30"); // public data; 30s of staleness is fine
      return searchEvents(request.query);
    },
  );
}
