// Full-text search. With OpenSearch on: a real relevance search. With it off: a simple DynamoDB fallback,
// and the response says so (`source`). CONCEPT: full-text-search, graceful-degradation
import { EVENTS_INDEX, type Event, type SearchQuery, type SearchResponse } from "@ticketlite/shared";
import { getSearchClient } from "../lib/opensearch";
import { listEventsByCity, listEventsByStatus } from "../repositories/events-repository";

export async function searchEvents(query: SearchQuery): Promise<SearchResponse> {
  const client = getSearchClient();
  return client ? searchOpenSearch(client, query) : searchDynamoDbFallback(query);
}

async function searchOpenSearch(
  client: NonNullable<ReturnType<typeof getSearchClient>>,
  query: SearchQuery,
): Promise<SearchResponse> {
  // The query DSL as a plain object (OpenSearch's typed request types are stricter than the DSL itself).
  const body = {
    size: query.limit,
    query: {
      bool: {
        // multi_match: the words may appear in any of these fields; a match in the name counts 3x.
        // fuzziness AUTO tolerates typos ("jaz" finds "Jazz"). CONCEPT: relevance-scoring
        must: [
          {
            multi_match: { query: query.q, fields: ["name^3", "venue", "description"], fuzziness: "AUTO" },
          },
        ],
        // filter: yes/no conditions. No scoring, and OpenSearch can cache them.
        filter: [{ term: { status: "PUBLISHED" } }],
      },
    },
    // post_filter applies the city AFTER the aggregation, so the city buttons still show every city.
    ...(query.city ? { post_filter: { term: { city: query.city } } } : {}),
    // Relevance decides WHAT matches; among the matches, show the soonest first (the spec's choice).
    sort: [{ startsAt: { order: "asc" as const } }],
    aggs: { cities: { terms: { field: "city", size: 10 } } }, // CONCEPT: aggregations
  };
  const response = await client.search({ index: EVENTS_INDEX, body });

  const result = response.body as unknown as {
    hits: { total: { value: number }; hits: Array<{ _source: Event }> };
    aggregations: { cities: { buckets: Array<{ key: string; doc_count: number }> } };
  };
  return {
    items: result.hits.hits.map((hit) => hit._source),
    total: result.hits.total.value,
    cities: result.aggregations.cities.buckets.map((b) => ({ city: b.key, count: b.doc_count })),
    source: "opensearch",
  };
}

// The fallback: read one indexed page (never a Scan) and match the words in memory. No typo tolerance,
// no relevance ranking: exactly why search engines exist.
async function searchDynamoDbFallback(query: SearchQuery): Promise<SearchResponse> {
  const page = query.city
    ? await listEventsByCity(query.city, 50)
    : await listEventsByStatus("PUBLISHED", 50);
  const words = query.q.toLowerCase().split(/\s+/);
  const matches = page.items.filter((event) => {
    const text = `${event.name} ${event.venue} ${event.description}`.toLowerCase();
    return words.every((word) => text.includes(word));
  });

  const counts = new Map<string, number>();
  for (const event of matches) counts.set(event.city, (counts.get(event.city) ?? 0) + 1);
  return {
    items: matches.slice(0, query.limit),
    total: matches.length,
    cities: [...counts].map(([city, count]) => ({ city, count })),
    source: "dynamodb-fallback",
  };
}
