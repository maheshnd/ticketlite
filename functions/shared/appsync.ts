// Publishes a live seat update to AppSync (Mutation.publishSeatUpdate), signed with SigV4.
// The mutation only allows IAM auth (@aws_iam), so this Lambda's role (appsync:GraphQL on that one field)
// is the only thing that can call it. Browsers can't. CONCEPT: sigv4, real-time
import { Sha256 } from "@aws-crypto/sha256-js";
import { defaultProvider } from "@aws-sdk/credential-provider-node";
import { HttpRequest } from "@smithy/protocol-http";
import { SignatureV4 } from "@smithy/signature-v4";
import { logger } from "./powertools";

const url = process.env.APPSYNC_URL ? new URL(process.env.APPSYNC_URL) : undefined;
const signer = new SignatureV4({
  service: "appsync",
  region: process.env.AWS_REGION ?? "us-east-1",
  credentials: defaultProvider(), // the Lambda role's temporary credentials
  sha256: Sha256,
});

const mutation = `mutation Publish($input: SeatUpdateInput!) {
  publishSeatUpdate(input: $input) { eventId availableSeats updatedAt }
}`;

// Best effort: a failed live update must never fail a booking. Clients still see the right number on
// their next fetch. CONCEPT: graceful-degradation
export async function publishSeatUpdate(eventId: string, availableSeats: number) {
  if (!url) return;
  try {
    // Step 1: build the HTTP request, then sign it (adds Authorization, X-Amz-Date, X-Amz-Security-Token).
    const request = new HttpRequest({
      method: "POST",
      protocol: url.protocol,
      hostname: url.hostname,
      path: url.pathname,
      headers: { host: url.hostname, "content-type": "application/json" },
      body: JSON.stringify({ query: mutation, variables: { input: { eventId, availableSeats } } }),
    });
    const signed = await signer.sign(request);

    // Step 2: send it. A short timeout: the saga step is waiting. CONCEPT: timeout-chain
    const response = await fetch(url, {
      method: "POST",
      headers: signed.headers,
      body: signed.body,
      signal: AbortSignal.timeout(2000),
    });
    const result = (await response.json()) as { errors?: unknown[] };
    if (result.errors) logger.warn("publishSeatUpdate returned errors", { errors: result.errors });
  } catch (error) {
    logger.warn("publishSeatUpdate failed", { error: error as Error });
  }
}
