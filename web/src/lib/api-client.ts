// The ONE fetch wrapper every API call goes through. It:
//   1. sends a correlation id (x-correlation-id) so a request can be found in the backend logs,
//   2. attaches the in-memory access token,
//   3. on 401, refreshes the token ONCE and retries the request,
//   4. turns problem+json errors into ApiError with status, title and detail.
import type { TokenResponse } from "@ticketlite/shared";
import { getAccessToken, setAccessToken } from "./token-store";

// "" in the cloud (same origin as the page). Locally: the API on http://localhost:3000.
export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly title: string,
    readonly detail: string,
    readonly correlationId?: string,
  ) {
    super(detail);
  }
}

type Options = { method?: string; body?: unknown; headers?: Record<string, string>; retryOn401?: boolean };

export async function apiFetch<T>(path: string, options: Options = {}): Promise<T> {
  // Step 1: build the request. credentials: "include" sends the refresh cookie (needed cross-origin locally).
  const token = getAccessToken();
  const response = await fetch(`${API_URL}${path}`, {
    method: options.method ?? "GET",
    credentials: "include",
    headers: {
      "x-correlation-id": crypto.randomUUID(), // CONCEPT: correlation-id
      ...(options.body !== undefined ? { "content-type": "application/json" } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  // Step 2: an expired access token -> refresh once, then retry. A second 401 is final.
  if (response.status === 401 && token && options.retryOn401 !== false) {
    const fresh = await refreshAccessToken();
    if (fresh) return apiFetch<T>(path, { ...options, retryOn401: false });
  }

  // Step 3: errors become ApiError (the API always answers errors with problem+json).
  if (!response.ok) {
    const problem = await response.json().catch(() => ({}));
    throw new ApiError(
      response.status,
      problem.title ?? response.statusText,
      problem.detail ?? "Something went wrong.",
      problem.correlationId,
    );
  }

  // Step 4: 204 No Content has no body.
  return (response.status === 204 ? undefined : await response.json()) as T;
}

// Several requests may hit 401 at the same moment; they all share ONE refresh call.
let refreshing: Promise<string | null> | null = null;

export function refreshAccessToken(): Promise<string | null> {
  refreshing ??= apiFetch<TokenResponse>("/api/auth/refresh", {
    method: "POST",
    headers: { "x-csrf": "1" }, // CONCEPT: csrf
    retryOn401: false,
  })
    .then((tokens) => tokens.accessToken)
    .catch(() => null) // no valid refresh cookie = logged out
    .then((token) => {
      setAccessToken(token);
      refreshing = null;
      return token;
    });
  return refreshing;
}
