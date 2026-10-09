// An RFC 9457 problem+json error response, the shape the real API returns for every error.
import { HttpResponse } from "msw";

export const problem = (status: number, title: string, detail: string) =>
  HttpResponse.json(
    { type: "about:blank", title, status, detail },
    { status, headers: { "content-type": "application/problem+json" } },
  );
