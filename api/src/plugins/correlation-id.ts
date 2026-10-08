// Gives every request a correlation ID: one ID that follows a request through every log line,
// Step Functions execution and EventBridge event, so one search finds the whole story.
// CONCEPT: correlation-id, distributed-tracing
import { randomUUID } from "node:crypto";
import type { RawRequestDefaultExpression } from "fastify";
import type { App } from "../types";

export const CORRELATION_HEADER = "x-correlation-id";

// Only short, plain IDs are accepted. A caller could otherwise inject newlines or huge strings into our logs.
const SAFE_ID = /^[A-Za-z0-9._-]{1,100}$/;

// Step 1: Fastify calls this to create `request.id`. Reuse the caller's ID if it is safe, else make a new one.
// (Passed to Fastify({ genReqId }) in app.ts, so the ID exists before any hook or log line runs.)
export function genCorrelationId(req: RawRequestDefaultExpression): string {
  const incoming = req.headers[CORRELATION_HEADER];
  return typeof incoming === "string" && SAFE_ID.test(incoming) ? incoming : randomUUID();
}

// Step 2: send the ID back, so a user reporting a problem can quote it and we can find their request.
export function registerCorrelationId(app: App) {
  app.addHook("onRequest", async (request, reply) => {
    reply.header(CORRELATION_HEADER, request.id);
  });
}
