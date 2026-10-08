// search-indexer: keeps the OpenSearch "events" index in sync with the DynamoDB Events table.
// DynamoDB Streams -> Lambda (poll-based: Lambda reads the stream in order, per shard, in batches).
// CONCEPT: cqrs, eventual-consistency, streams
//   PUBLISHED event inserted/changed -> upsert the document
//   draft or deleted                 -> delete the document (drafts must never be searchable)
import type { AttributeValue } from "@aws-sdk/client-dynamodb";
import { unmarshall } from "@aws-sdk/util-dynamodb";
import { EVENTS_INDEX, eventsIndexBody, toSearchDocument, type Event } from "@ticketlite/shared";
import type { DynamoDBBatchResponse, DynamoDBStreamEvent } from "aws-lambda";
import { createSearchClient } from "../shared/opensearch";
import { logger } from "../shared/powertools";

const search = createSearchClient(process.env.OPENSEARCH_ENDPOINT ?? "http://localhost:9200");
let indexReady = false;

// The index (with its mapping) is created on first use, so a fresh domain needs no manual setup.
async function ensureIndex() {
  if (indexReady) return;
  const exists = await search.indices.exists({ index: EVENTS_INDEX });
  if (!exists.body) await search.indices.create({ index: EVENTS_INDEX, body: eventsIndexBody as never });
  indexReady = true;
}

export const handler = async (event: DynamoDBStreamEvent): Promise<DynamoDBBatchResponse> => {
  await ensureIndex();

  for (const record of event.Records) {
    try {
      const newImage = record.dynamodb?.NewImage;
      const eventId = (
        unmarshall(record.dynamodb!.Keys as Record<string, AttributeValue>) as { eventId: string }
      ).eventId;
      const doc = newImage ? (unmarshall(newImage as Record<string, AttributeValue>) as Event) : undefined;

      if (doc?.status === "PUBLISHED") {
        await search.index({ index: EVENTS_INDEX, id: eventId, body: toSearchDocument(doc) });
      } else {
        // Deleted, or turned back into a draft. A 404 (never indexed) is fine.
        await search.delete({ index: EVENTS_INDEX, id: eventId }).catch((e: { statusCode?: number }) => {
          if (e.statusCode !== 404) throw e;
        });
      }
    } catch (error) {
      // Partial batch response: report THIS record (and, for streams, everything after it is retried).
      // With bisectBatchOnFunctionError, Lambda also splits failing batches to isolate a poison record.
      logger.error("indexing failed", { error: error as Error, sequence: record.dynamodb?.SequenceNumber });
      return { batchItemFailures: [{ itemIdentifier: record.dynamodb!.SequenceNumber! }] };
    }
  }
  return { batchItemFailures: [] };
};
