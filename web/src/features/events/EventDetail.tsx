"use client";
// The event detail: name, date, venue, price, poster and the seat count.
// The seat count sits in an aria-live region, so screen readers announce it when it changes
// (live updates arrive in M4 through the AppSync subscription).
import { ApiError } from "../../lib/api-client";
import { formatDate, formatPrice } from "../../lib/format";
import { PageHeading } from "../../components/PageHeading";
import { useEvent } from "./events-queries";

export function EventDetail({ eventId }: { eventId: string }) {
  const { data: event, error, isPending } = useEvent(eventId);

  if (!eventId) return <p role="alert">No event selected.</p>;
  if (isPending) return <p role="status">Loading event…</p>;
  if (error) {
    const notFound = error instanceof ApiError && error.status === 404;
    return (
      <p role="alert">
        {notFound ? "This event does not exist." : `Could not load the event: ${error.message}`}
      </p>
    );
  }

  return (
    <article className="flex flex-col gap-3">
      <PageHeading>{event.name}</PageHeading>
      {event.posterKey && (
        // Posters are served by CloudFront from the posters bucket ("/posters/<eventId>/<file>").
        // eslint-disable-next-line @next/next/no-img-element -- static export: next/image can't optimize
        <img
          src={`/${event.posterKey}`}
          alt={`Poster for ${event.name}`}
          width={640}
          height={360}
          className="rounded"
        />
      )}
      <p>
        <time dateTime={event.startsAt}>{formatDate(event.startsAt)}</time> · {event.venue}, {event.city}
      </p>
      <p className="text-lg font-semibold">{formatPrice(event.price)}</p>
      <p aria-live="polite" className="font-medium">
        {event.availableSeats} of {event.totalSeats} seats left
      </p>
      <p className="text-slate-700">{event.description}</p>
    </article>
  );
}
