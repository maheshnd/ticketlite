// Local development only: copies the published events from DynamoDB Local into the local OpenSearch
// (docker-compose), creating the index with the real mapping. In AWS the search-indexer Lambda does this
// from the DynamoDB stream.
//   DYNAMODB_ENDPOINT=http://localhost:8000 pnpm tsx scripts/index-local-search.ts
import { QueryCommand } from "@aws-sdk/lib-dynamodb";
import { EVENTS_INDEX, eventsIndexBody, toSearchDocument, type Event } from "@ticketlite/shared";
import { ddb } from "./dynamodb-client";

const OPENSEARCH = process.env.OPENSEARCH_ENDPOINT ?? "http://localhost:9200";
const call = (method: string, path: string, body?: unknown) =>
  fetch(`${OPENSEARCH}${path}`, {
    method,
    headers: { "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });

// Step 1: recreate the index so mapping changes take effect.
await call("DELETE", `/${EVENTS_INDEX}`);
const created = await call("PUT", `/${EVENTS_INDEX}`, eventsIndexBody);
if (!created.ok) throw new Error(`create index failed: ${await created.text()}`);

// Step 2: index every published event (one Query on the byStatus index).
const { Items = [] } = await ddb.send(
  new QueryCommand({
    TableName: "Events",
    IndexName: "byStatus",
    KeyConditionExpression: "#s = :p",
    ExpressionAttributeNames: { "#s": "status" },
    ExpressionAttributeValues: { ":p": "PUBLISHED" },
  }),
);
for (const event of Items as Event[])
  await call("PUT", `/${EVENTS_INDEX}/_doc/${event.eventId}`, toSearchDocument(event));
await call("POST", `/${EVENTS_INDEX}/_refresh`); // make them searchable now (normally ~1s)
console.log(`indexed ${Items.length} events into ${OPENSEARCH}/${EVENTS_INDEX}`);
