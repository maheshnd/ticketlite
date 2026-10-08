// AppSync Lambda resolver for Event.organizer, invoked with BatchInvoke. CONCEPT: n-plus-one
// AppSync sends ONE event with a LIST of payloads (one per Event in the response, up to maxBatchSize) and
// expects a list of results back IN THE SAME ORDER. We answer with one DynamoDB BatchGetItem.
import { BatchGetCommand } from "@aws-sdk/lib-dynamodb";
import { ddb } from "../shared/dynamodb";
import { logger } from "../shared/powertools";

type Payload = { organizerId: string };
type Organizer = { organizerId: string; name: string };

const ORGANIZERS_TABLE = process.env.ORGANIZERS_TABLE!;

export const handler = async (payloads: Payload[]): Promise<Array<Organizer | null>> => {
  // Step 1: many events share an organizer: fetch each id once. (BatchGetItem accepts up to 100 keys.)
  const ids = [...new Set(payloads.map((p) => p.organizerId))];
  logger.info("organizer batch", { batchSize: payloads.length, uniqueIds: ids.length }); // the N+1 fix, visible in logs

  const result = await ddb.send(
    new BatchGetCommand({
      RequestItems: { [ORGANIZERS_TABLE]: { Keys: ids.map((organizerId) => ({ organizerId })) } },
    }),
  );
  // A production version would retry result.UnprocessedKeys (returned when DynamoDB is throttling).
  const byId = new Map(
    (result.Responses?.[ORGANIZERS_TABLE] ?? []).map((o) => [o.organizerId as string, o as Organizer]),
  );

  // Step 2: one answer per payload, in the original order. null = unknown organizer.
  return payloads.map((p) => byId.get(p.organizerId) ?? null);
};
