// One place that turns every error into an RFC 9457 "problem details" response (application/problem+json).
// Known errors keep their status (400/401/403/404/409/429). Unknown errors become a 500 that never
// leaks internals (stack traces, table names) to the caller. CONCEPT: error-handling
import type { FastifyReply, FastifyRequest } from "fastify";
import { hasZodFastifySchemaValidationErrors } from "fastify-type-provider-zod";
import { HttpError } from "../errors";
import type { App } from "../types";

// Step 1: the response shape. `correlationId` lets support find the matching log lines.
function sendProblem(
  request: FastifyRequest,
  reply: FastifyReply,
  status: number,
  title: string,
  detail: string,
  extra: Record<string, unknown> = {},
) {
  const body = {
    type: "about:blank",
    title,
    status,
    detail,
    instance: request.url,
    correlationId: request.id,
    ...extra,
  };
  return reply.code(status).type("application/problem+json").send(JSON.stringify(body));
}

export function registerErrorHandler(app: App) {
  app.setErrorHandler((error, request, reply) => {
    // Step 2: the request did not match the route's Zod schema -> 400 with each problem listed.
    if (hasZodFastifySchemaValidationErrors(error)) {
      const errors = error.validation.map((v) => ({ path: v.instancePath, message: v.message }));
      return sendProblem(request, reply, 400, "Bad Request", "The request is not valid.", { errors });
    }

    // Step 3: an error we threw on purpose (see errors.ts).
    if (error instanceof HttpError) {
      reply.headers(error.headers);
      return sendProblem(request, reply, error.statusCode, error.title, error.detail);
    }

    // Step 4: Fastify's own client errors, e.g. malformed JSON (400) or a body that is too large (413).
    const status = (error as { statusCode?: number }).statusCode;
    if (status && status >= 400 && status < 500) {
      return sendProblem(request, reply, status, "Bad Request", (error as Error).message);
    }

    // Step 5: anything else is a bug. Log everything, tell the caller nothing.
    request.log.error({ err: error }, "unhandled error");
    return sendProblem(
      request,
      reply,
      500,
      "Internal Server Error",
      "Something went wrong. Quote the correlationId if you report it.",
    );
  });

  // Step 6: unknown routes get the same problem+json shape as every other error.
  app.setNotFoundHandler((request, reply) =>
    sendProblem(request, reply, 404, "Not Found", `No route for ${request.method} ${request.url}`),
  );
}
