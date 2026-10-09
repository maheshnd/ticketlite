// Makes a POST safe to retry. The client sends an Idempotency-Key header (a random UUID per user action);
// retrying with the same key returns the FIRST response instead of doing the work twice.
// CONCEPT: idempotency
//   same key + same request, finished   -> replay the stored response
//   same key + same request, still busy -> 409 (try again shortly)
//   same key + DIFFERENT request        -> 422 (a client bug: keys must not be reused)
import { createHash } from "node:crypto";
import { conflict, unprocessable } from "../errors";
import { claimKey, completeKey, getKey, releaseKey } from "../repositories/idempotency-repository";

export type StoredResponse<T> = { status: number; body: T; replayed: boolean };

export async function withIdempotency<T>(
  userId: string,
  idempotencyKey: string,
  request: unknown,
  work: () => Promise<{ status: number; body: T }>,
): Promise<StoredResponse<T>> {
  // Step 1: keys are per user, so two users can't collide (or read each other's responses).
  const key = `${userId}#${idempotencyKey}`;
  const requestHash = createHash("sha256").update(JSON.stringify(request)).digest("hex");

  // Step 2: try to claim the key. Only one concurrent request can win this conditional write.
  const claimed = await claimKey(key, requestHash);
  if (!claimed) {
    const existing = await getKey(key);
    if (existing && existing.requestHash !== requestHash) {
      throw unprocessable("This Idempotency-Key was already used for a different request.");
    }
    if (existing?.status === "COMPLETED") {
      return {
        status: existing.responseStatus!,
        body: JSON.parse(existing.responseBody!) as T,
        replayed: true,
      };
    }
    throw conflict("A request with this Idempotency-Key is still being processed. Retry in a moment.");
  }

  // Step 3: we own the key: do the work, then store the response for future retries.
  try {
    const response = await work();
    await completeKey(claimed, response.status, response.body);
    return { ...response, replayed: false };
  } catch (error) {
    // The work failed: free the key so the client can retry the SAME key and succeed later.
    await releaseKey(key).catch(() => undefined);
    throw error;
  }
}
