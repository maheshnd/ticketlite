// React Query hook for search. keepPreviousData keeps the old results on screen while the next ones
// load, so the list doesn't flicker on every keystroke. CONCEPT: react-query
import type { SearchResponse } from "@ticketlite/shared";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { apiFetch } from "../../lib/api-client";
import { searchKeys } from "../../lib/query-keys";

export function useSearch(q: string, city: string | undefined) {
  return useQuery({
    queryKey: searchKeys.query(q, city),
    queryFn: () => {
      const params = new URLSearchParams({ q });
      if (city) params.set("city", city);
      return apiFetch<SearchResponse>(`/api/search?${params}`);
    },
    enabled: q.length > 0, // no request for an empty box
    placeholderData: keepPreviousData,
  });
}
