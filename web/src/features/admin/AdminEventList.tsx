"use client";
// Admin list of ALL events (drafts too), with an instant publish/unpublish toggle (optimistic update).
import Link from "next/link";
import { FormAlert } from "../../components/FormAlert";
import { ApiError } from "../../lib/api-client";
import { formatDate } from "../../lib/format";
import { useAdminEvents, useToggleStatus } from "./admin-queries";

export function AdminEventList() {
  const { data: events, error, isPending } = useAdminEvents();
  const toggle = useToggleStatus();

  if (isPending) return <p role="status">Loading events…</p>;
  if (error) return <p role="alert">Could not load events: {error.message}</p>;

  return (
    <div className="flex flex-col gap-4">
      <FormAlert
        message={
          toggle.error
            ? toggle.error instanceof ApiError
              ? toggle.error.detail
              : toggle.error.message
            : null
        }
      />
      <Link href="/admin/events/new" className="self-start rounded bg-indigo-700 px-4 py-2 text-white">
        New event
      </Link>
      <table className="w-full border-collapse bg-white text-left">
        <caption className="sr-only">All events</caption>
        <thead>
          <tr className="border-b">
            <th scope="col" className="p-2">
              Event
            </th>
            <th scope="col" className="p-2">
              Starts
            </th>
            <th scope="col" className="p-2">
              Seats left
            </th>
            <th scope="col" className="p-2">
              Status
            </th>
          </tr>
        </thead>
        <tbody>
          {events.map((event) => (
            <tr key={event.eventId} className="border-b">
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
                  onClick={() => toggle.mutate(event)}
                  aria-label={`${event.status === "PUBLISHED" ? "Unpublish" : "Publish"} ${event.name}`}
                  className="rounded border px-2 py-1"
                >
                  {event.status}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
