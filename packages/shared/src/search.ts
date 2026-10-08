// Search: the API's request/response shapes, plus the OpenSearch index definition used by BOTH the
// search-indexer (writes) and the API (queries), so the two can never disagree. CONCEPT: search-mapping
import { z } from "zod";
import { EventSchema, type Event } from "./event";

// Step 1: GET /api/search?q=jazz&city=Pune
export const SearchQuerySchema = z.object({
  q: z.string().trim().min(1).max(100),
  city: z.string().min(2).max(60).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
export type SearchQuery = z.infer<typeof SearchQuerySchema>;

export const SearchResponseSchema = z.object({
  items: z.array(EventSchema),
  total: z.number().int(),
  // The aggregation: how many matching events per city (shown as filter buttons).
  cities: z.array(z.object({ city: z.string(), count: z.number().int() })),
  // Which engine answered. "dynamodb-fallback" when the OpenSearch flag is off (a much simpler search).
  source: z.enum(["opensearch", "dynamodb-fallback"]),
});
export type SearchResponse = z.infer<typeof SearchResponseSchema>;

// Step 2: the index. A MAPPING is the index's schema: which fields are full-text (`text`, analyzed into
// words) and which are exact values (`keyword`, for filters, sorting and aggregations).
export const EVENTS_INDEX = "events";

export const eventsIndexBody = {
  settings: {
    // 1 shard, 0 replicas: one small single-node domain can't place a replica anyway. A production
    // cluster would use at least 1 replica (on another node) for availability and read throughput.
    number_of_shards: 1,
    number_of_replicas: 0,
    analysis: {
      // A custom analyzer for names: lowercase + strip accents ("Café" matches "cafe") + English stemming
      // ("concerts" matches "concert"). CONCEPT: analyzers
      analyzer: {
        event_name: {
          type: "custom",
          tokenizer: "standard",
          filter: ["lowercase", "asciifolding", "porter_stem"],
        },
      },
    },
  },
  mappings: {
    properties: {
      eventId: { type: "keyword" },
      name: { type: "text", analyzer: "event_name", fields: { raw: { type: "keyword" } } },
      description: { type: "text" },
      venue: { type: "text" },
      city: { type: "keyword" }, // exact match: filter + aggregation
      status: { type: "keyword" },
      startsAt: { type: "date" },
      price: { type: "float" },
      availableSeats: { type: "integer" },
    },
  },
} as const;

// The search document is simply the event (the index is a read model built from DynamoDB). CONCEPT: cqrs
export const toSearchDocument = (event: Event) => event;
