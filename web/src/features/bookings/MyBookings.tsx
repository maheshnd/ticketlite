"use client";
// "My bookings": newest first, paged with a "Load more" button.
import Link from "next/link";
import { formatPrice } from "../../lib/format";
import { useAuth } from "../auth/auth-context";
import { useMyBookings } from "./bookings-queries";

export function MyBookings() {
  const { status } = useAuth();
  const { data, error, isPending, hasNextPage, fetchNextPage, isFetchingNextPage } = useMyBookings();

  if (status === "anonymous") {
    return (
      <p>
        <Link href="/login" className="text-indigo-700 underline">
          Log in
        </Link>{" "}
        to see your bookings.
      </p>
    );
  }
  if (status === "loading" || isPending) return <p role="status">Loading bookings…</p>;
  if (error) return <p role="alert">Could not load bookings: {error.message}</p>;

  const bookings = data.pages.flatMap((page) => page.items);
  if (bookings.length === 0) return <p>No bookings yet.</p>;

  return (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-col gap-2" aria-label="My bookings">
        {bookings.map((b) => (
          <li key={b.bookingId} className="rounded border border-slate-200 bg-white p-3">
            <Link
              href={`/booking?id=${encodeURIComponent(b.bookingId)}`}
              className="font-semibold text-indigo-700 underline"
            >
              {b.eventName}
            </Link>{" "}
            · {b.seats} seat{b.seats > 1 ? "s" : ""} · {formatPrice(b.amount)} · <strong>{b.status}</strong>
          </li>
        ))}
      </ul>
      {hasNextPage && (
        <button
          type="button"
          onClick={() => void fetchNextPage()}
          disabled={isFetchingNextPage}
          className="self-start underline"
        >
          Load more
        </button>
      )}
    </div>
  );
}
