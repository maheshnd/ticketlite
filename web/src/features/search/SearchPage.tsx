"use client";
// Search: a debounced search box (one request after typing stops), results, and the city aggregation as
// filter buttons. CONCEPT: debouncing, full-text-search
import { useState } from "react";
import { useDebouncedValue } from "../../lib/use-debounced-value";
import { EventCard } from "../events/EventCard";
import { CityFilters } from "./CityFilters";
import { useSearch } from "./search-queries";

// The search box. role="search" makes it a landmark screen readers can jump to.
function SearchBox({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <div role="search" className="flex flex-col gap-1">
      <label htmlFor="q">Search events</label>
      <input
        id="q"
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="e.g. jazz"
        className="rounded border border-slate-400 p-2"
      />
    </div>
  );
}

export function SearchPage() {
  const [input, setInput] = useState("");
  const [city, setCity] = useState<string | undefined>(undefined);
  const { data, error, isFetching } = useSearch(useDebouncedValue(input.trim()), city);

  return (
    <div className="mt-4 flex flex-col gap-4">
      <SearchBox value={input} onChange={setInput} />

      {data && data.cities.length > 0 && (
        <CityFilters cities={data.cities} selected={city} onSelect={setCity} />
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
