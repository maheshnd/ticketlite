// One QueryClient for the whole app, with defaults chosen for this API. CONCEPT: react-query
import { QueryClient } from "@tanstack/react-query";
import { ApiError } from "./api-client";

export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Data counts as fresh for 30s: navigating back to a page shows it instantly, without a refetch.
        staleTime: 30_000,
        // Retry network glitches and 5xx twice, but never 4xx: a 404 or 403 won't fix itself.
        retry: (failureCount, error) =>
          !(error instanceof ApiError && error.status < 500) && failureCount < 2,
      },
    },
  });
}
