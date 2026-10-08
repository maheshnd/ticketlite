"use client";
// One event in the list. Hovering or focusing the link prefetches the detail page's data.
import type { Event } from "@ticketlite/shared";
import Link from "next/link";
import { formatDate, formatPrice } from "../../lib/format";
import { usePrefetchEvent } from "./events-queries";

export function EventCard({ event }: { event: Event }) {
  const prefetch = usePrefetchEvent();
  return (
    <li className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="text-lg font-semibold">
        <Link
          href={`/event?id=${encodeURIComponent(event.eventId)}`}
          onMouseEnter={() => prefetch(event.eventId)}
          onFocus={() => prefetch(event.eventId)}
          className="text-indigo-700 underline-offset-2 hover:underline"
        >
          {event.name}
        </Link>
      </h2>
      <p className="text-slate-700">
        {event.city} · {event.venue}
      </p>
      <p className="text-slate-700">
        <time dateTime={event.startsAt}>{formatDate(event.startsAt)}</time> · {formatPrice(event.price)}
      </p>
    </li>
  );
}
