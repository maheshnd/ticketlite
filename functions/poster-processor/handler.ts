// poster-processor: runs when a poster lands in S3 ("posters/<eventId>/<file>").
// S3 invokes it ASYNCHRONOUSLY: S3 doesn't wait. If the function throws, Lambda retries it twice, then sends
// the event to the on-failure destination (an SQS queue) so nothing is lost silently. CONCEPT: async-invocation
//   valid image  -> set the event's posterKey (the web app then shows it)
//   invalid file -> delete it (not an error: retrying wouldn't make it valid)
import { ConditionalCheckFailedException } from "@aws-sdk/client-dynamodb";
import { DeleteObjectCommand, GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { POSTER_MAX_BYTES } from "@ticketlite/shared";
import type { S3Event } from "aws-lambda";
import { ddb, tableName } from "../shared/dynamodb";
import { logger, tracer } from "../shared/powertools";
import { detectImageType } from "./image-type";

const EVENTS_TABLE = tableName("EVENTS_TABLE");
const s3 = tracer.captureAWSv3Client(new S3Client({}));

export const handler = async (event: S3Event) => {
  for (const record of event.Records) {
    // Step 1: S3 URL-encodes keys in events ("+" for spaces).
    const bucket = record.s3.bucket.name;
    const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, " "));
    const eventId = key.split("/")[1];
    logger.appendKeys({ key });

    // Step 2: validate. The presigned POST already limited the size; we check again (never trust one layer).
    // Range: read only the first 12 bytes, enough for the magic numbers, not the whole file.
    const head = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key, Range: "bytes=0-11" }));
    const bytes = await head.Body!.transformToByteArray();
    const type = detectImageType(bytes);
    if (!eventId || !type || record.s3.object.size > POSTER_MAX_BYTES) {
      logger.warn("rejected poster", { type, size: record.s3.object.size });
      await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
      continue;
    }

    // Step 3: point the event at the new poster. It does NOT bump `version`: an admin editing the event at
    // the same moment shouldn't get a conflict just because a poster finished processing.
    try {
      await ddb.send(
        new UpdateCommand({
          TableName: EVENTS_TABLE,
          Key: { eventId },
          UpdateExpression: "SET posterKey = :key, updatedAt = :now",
          ConditionExpression: "attribute_exists(eventId)", // never create a half-empty event
          ExpressionAttributeValues: { ":key": key, ":now": new Date().toISOString() },
        }),
      );
      logger.info("poster attached", { eventId, type });
    } catch (error) {
      if (!(error instanceof ConditionalCheckFailedException)) throw error; // retried, then on-failure queue
      logger.warn("event no longer exists; deleting poster", { eventId });
      await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
    }
  }
};
