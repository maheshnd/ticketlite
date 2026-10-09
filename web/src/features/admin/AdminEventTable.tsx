// The admin events table: one row per event (drafts too) with a publish/unpublish button.
// The button's aria-label names the action AND the event, so screen-reader users know what it does.
// CONCEPT: accessibility
import type { Event } from "@ticketlite/shared";
import Link from "next/link";
import { formatDate } from "../../lib/format";

type Props = { events: Event[]; onToggle: (event: Event) => void };

function EventRow({ event, onToggle }: { event: Event; onToggle: (event: Event) => void }) {
  const action = event.status === "PUBLISHED" ? "Unpublish" : "Publish";
  return (
    <tr className="border-b">
      <td className="p-2">
        <Link
          href={`/admin/events/edit?id=${encodeURIComponent(event.eventId)}`}
          className="text-indigo-700 underline"
        >
          {event.name}
        </Link>
      </td>
      <td className="p-2">{formatDate(event.startsAt)}</td>
      <td className="p-2">{event.availableSeats}</td>
      <td className="p-2">
        <button
          type="button"
          onClick={() => onToggle(event)}
          aria-label={`${action} ${event.name}`}
          className="rounded border px-2 py-1"
        >
          {event.status}
        </button>
      </td>
    </tr>
  );
}

export function AdminEventTable({ events, onToggle }: Props) {
  return (
    <table className="w-full border-collapse bg-white text-left">
      <caption className="sr-only">All events</caption>
      <thead>
        <tr className="border-b">
          {["Event", "Starts", "Seats left", "Status"].map((heading) => (
            <th key={heading} scope="col" className="p-2">
              {heading}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {events.map((event) => (
          <EventRow key={event.eventId} event={event} onToggle={onToggle} />
        ))}
      </tbody>
    </table>
  );
}
