"use client";
// The events list: a city filter, cards, and infinite scroll (pages of 12, loaded as the user scrolls).
// Besides the scroll trigger there is a real "Load more" button, so keyboard and screen-reader users (who
// never "scroll to the bottom") can load more too. CONCEPT: pagination, accessibility
import { useState } from "react";
import { useInfiniteScroll } from "../../lib/use-infinite-scroll";
import { CityFilter } from "./CityFilter";
import { EventCard } from "./EventCard";
import { useEventList } from "./events-queries";

export function EventList() {
  const [city, setCity] = useState<string | undefined>(undefined);
  const { data, error, isPending, fetchNextPage, hasNextPage, isFetchingNextPage } = useEventList(city);
  const sentinel = useInfiniteScroll({ hasNextPage, isFetchingNextPage, fetchNextPage });
  const events = data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <div className="mt-4 flex flex-col gap-4">
      <CityFilter onFilter={setCity} />

      {/* Loading, error and empty states. */}
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
