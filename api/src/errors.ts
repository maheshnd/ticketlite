// Errors that services and routes throw on purpose. The error handler (plugins/error-handler.ts)
// turns each one into an RFC 9457 "problem details" response with the right HTTP status.
// Anything that is NOT an HttpError is treated as a bug and becomes a generic 500.

export class HttpError extends Error {
  constructor(
    readonly statusCode: number,
    readonly title: string,
    readonly detail: string,
    // Extra response headers, e.g. Retry-After on a 429.
    readonly headers: Record<string, string> = {},
  ) {
    super(detail);
  }
}

// One small factory per status code we use, so call sites read like English: `throw notFound("...")`.
export const badRequest = (detail: string) => new HttpError(400, "Bad Request", detail);
export const unauthorized = (detail = "Log in first.") => new HttpError(401, "Unauthorized", detail);
export const forbidden = (detail = "You are not allowed to do this.") =>
  new HttpError(403, "Forbidden", detail);
export const notFound = (detail: string) => new HttpError(404, "Not Found", detail);
export const conflict = (detail: string) => new HttpError(409, "Conflict", detail);
export const unprocessable = (detail: string) => new HttpError(422, "Unprocessable Content", detail);
export const serviceUnavailable = (detail: string) => new HttpError(503, "Service Unavailable", detail);
export const tooManyRequests = (retryAfterSeconds: number) =>
  new HttpError(429, "Too Many Requests", "Slow down and try again later.", {
    "retry-after": String(retryAfterSeconds),
  });
