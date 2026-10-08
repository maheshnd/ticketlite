# Search (OpenSearch)

Code: `infra/search.ts` (flag `enableSearch`), `packages/shared/src/search.ts` (index + mapping),
`functions/search-indexer`, `api/src/services/search-service.ts`, `web/src/features/search`.

## Why a separate search engine?

DynamoDB finds items by **key**. It can't answer "events whose name sounds like *jaz*", rank results by relevance or
count matches per city. OpenSearch is a **separate read model**: the indexer copies every published event from the
DynamoDB stream into an index shaped for search (CQRS). The price is **eventual consistency**: search lags the table
by about a second, and the two can drift if the indexer fails (hence its failure queue).

## Concepts

| Concept | What it means | Here |
|---|---|---|
| **Index / document** | An index is a collection of JSON documents (≈ a table of rows) | Index `events`, one document per published event (`_id` = eventId) |
| **Inverted index** | For each word, the list of documents containing it: lookups by word are instant | Built from `name`, `venue`, `description` |
| **Mapping** | The index schema: field types decide how each field is stored and searched | `text` (analyzed words) for name/description/venue; `keyword` (exact) for city/status; `date`, `float`, `integer` |
| **Analyzer** | Turns text into searchable terms: tokenizer + filters | Custom `event_name`: standard tokenizer, lowercase, ASCII folding (café → cafe), English stemming (nights → night) |
| **Relevance scoring** | BM25: rare words that appear often in a short field score high; `name^3` triples name matches | `multi_match` with `fuzziness: AUTO` (typos) |
| **Filter vs query** | Filters are yes/no and cacheable; queries score | `status = PUBLISHED` filter; city as `post_filter` so the aggregation still counts every city |
| **Aggregation** | Counts/statistics over the matches | `terms` on `city` → the city buttons |
| **Shard** | An index is split into shards (each a Lucene index) spread across nodes: horizontal scaling of data and writes | 1 primary shard (tiny data) |
| **Replica** | A copy of each shard on another node: availability and more read throughput | 0 (one node can't hold its own replica) |
| **Scaling** | Scale up (bigger nodes) or out (more nodes + shards); dedicated master nodes for cluster stability; UltraWarm/cold for old data | One `t3.small.search` node, OpenSearch 3.7 |

## Local

```bash
docker compose up -d opensearch dynamodb && pnpm db:local
DYNAMODB_ENDPOINT=http://localhost:8000 pnpm tsx scripts/index-local-search.ts
OPENSEARCH_ENDPOINT=http://localhost:9200 DYNAMODB_ENDPOINT=http://localhost:8000 pnpm --filter @ticketlite/api dev
curl "localhost:3000/api/search?q=jaz"     # typo still finds "Jazz by the Lake"
```

With `enableSearch` off (the default) `/api/search` answers from DynamoDB (`source: "dynamodb-fallback"`): exact
word matching on one page of events, no ranking, no typo tolerance.
