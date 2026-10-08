"use client";
// The events list: a city filter, cards, and infinite scroll.
// Infinite scroll uses an IntersectionObserver on a sentinel element, AND a real "Load more" button,
// so keyboard and screen-reader users (who never "scroll to the bottom") can load more too.
import { useEffect, useRef, useState } from "react";
import { EventCard } from "./EventCard";
import { useEventList } from "./events-queries";

export function EventList() {
  const [city, setCity] = useState<string | undefined>(undefined);
  const [cityInput, setCityInput] = useState("");
  const { data, error, isPending, fetchNextPage, hasNextPage, isFetchingNextPage } = useEventList(city);

  // Step 1: when the sentinel scrolls into view, load the next page.
  const sentinel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = sentinel.current;
    if (!element || !hasNextPage) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting && !isFetchingNextPage) void fetchNextPage();
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const events = data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <div className="mt-4 flex flex-col gap-4">
      {/* Step 2: the filter. role="search" makes it a landmark screen readers can jump to. */}
      <form
        role="search"
        className="flex items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setCity(cityInput.trim() || undefined);
        }}
      >
        <div className="flex flex-col gap-1">
          <label htmlFor="city">City</label>
          <input
            id="city"
            value={cityInput}
            onChange={(e) => setCityInput(e.target.value)}
            placeholder="e.g. Pune"
            className="rounded border border-slate-400 p-2"
          />
        </div>
        <button type="submit" className="rounded bg-indigo-700 px-4 py-2 text-white">
          Filter
        </button>
      </form>

      {/* Step 3: loading, error and empty states. */}
      {isPending && <p role="status">Loading events…</p>}
      {error && <p role="alert">Could not load events: {error.message}</p>}
      {!isPending && !error && events.length === 0 && <p>No events{city ? ` in ${city}` : ""} yet.</p>}

      <ul className="grid gap-4 sm:grid-cols-2" aria-label="Events">
        {events.map((event) => (
          <EventCard key={event.eventId} event={event} />
        ))}
      </ul>

      <div ref={sentinel} />
      {hasNextPage && (
        <button
          type="button"
          onClick={() => void fetchNextPage()}
          disabled={isFetchingNextPage}
          className="self-center rounded border border-indigo-700 px-4 py-2 text-indigo-700"
        >
          {isFetchingNextPage ? "Loading…" : "Load more"}
        </button>
      )}
    </div>
  );
}
