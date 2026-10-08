"use client";
// Search: a debounced search box, results, and the city aggregation as filter buttons.
// keepPreviousData-style placeholder keeps the old results on screen while the next ones load (no flicker).
import type { SearchResponse } from "@ticketlite/shared";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { apiFetch } from "../../lib/api-client";
import { searchKeys } from "../../lib/query-keys";
import { useDebouncedValue } from "../../lib/use-debounced-value";
import { EventCard } from "../events/EventCard";

export function SearchPage() {
  const [input, setInput] = useState("");
  const [city, setCity] = useState<string | undefined>(undefined);
  const q = useDebouncedValue(input.trim());

  const { data, error, isFetching } = useQuery({
    queryKey: searchKeys.query(q, city),
    queryFn: () => {
      const params = new URLSearchParams({ q });
      if (city) params.set("city", city);
      return apiFetch<SearchResponse>(`/api/search?${params}`);
    },
    enabled: q.length > 0,
    placeholderData: keepPreviousData,
  });

  return (
    <div className="mt-4 flex flex-col gap-4">
      <div role="search" className="flex flex-col gap-1">
        <label htmlFor="q">Search events</label>
        <input
          id="q"
          type="search"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="e.g. jazz"
          className="rounded border border-slate-400 p-2"
        />
      </div>

      {data && data.cities.length > 0 && (
        <div role="group" aria-label="Filter by city" className="flex flex-wrap gap-2">
          <button
            type="button"
            aria-pressed={!city}
            onClick={() => setCity(undefined)}
            className="rounded border px-3 py-1 aria-pressed:bg-indigo-700 aria-pressed:text-white"
          >
            All
          </button>
          {data.cities.map((c) => (
            <button
              key={c.city}
              type="button"
              aria-pressed={city === c.city}
              onClick={() => setCity(c.city)}
              className="rounded border px-3 py-1 aria-pressed:bg-indigo-700 aria-pressed:text-white"
            >
              {c.city} ({c.count})
            </button>
          ))}
        </div>
      )}

      {/* One live region for the result count, so screen readers hear how many matches there are. */}
      <p aria-live="polite" className="text-slate-700">
        {isFetching && "Searching…"}
        {!isFetching && data && `${data.total} result${data.total === 1 ? "" : "s"}`}
      </p>
      {data?.source === "dynamodb-fallback" && (
        <p className="text-sm text-slate-600">
          Basic search (OpenSearch is switched off in this environment).
        </p>
      )}
      {error && <p role="alert">Search failed: {error.message}</p>}

      <ul className="grid gap-4 sm:grid-cols-2" aria-label="Search results">
        {data?.items.map((event) => (
          <EventCard key={event.eventId} event={event} />
        ))}
      </ul>
    </div>
  );
}
