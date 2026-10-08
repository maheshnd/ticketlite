"use client";
// The "Book" control on the event page: pick 1-6 seats, then book. Anonymous users get a login link.
import type { Event } from "@ticketlite/shared";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { FormAlert } from "../../components/FormAlert";
import { ApiError } from "../../lib/api-client";
import { useAuth } from "../auth/auth-context";
import { useCreateBooking } from "./bookings-queries";

export function BookButton({ event }: { event: Event }) {
  const { status } = useAuth();
  const router = useRouter();
  const [seats, setSeats] = useState(1);
  const createBooking = useCreateBooking();
  // One key per booking ATTEMPT: kept across retries of the same click, replaced after a success.
  const idempotencyKey = useRef<string | null>(null);

  if (status !== "authenticated") {
    return (
      <Link href="/login" className="self-start rounded bg-indigo-700 px-4 py-2 text-white">
        Log in to book
      </Link>
    );
  }
  if (event.availableSeats === 0) return <p className="font-medium">Sold out</p>;

  function book() {
    idempotencyKey.current ??= crypto.randomUUID();
    createBooking.mutate(
      { input: { eventId: event.eventId, seats }, idempotencyKey: idempotencyKey.current },
      {
        onSuccess: ({ bookingId }) => {
          idempotencyKey.current = null;
          router.push(`/booking?id=${encodeURIComponent(bookingId)}`);
        },
      },
    );
  }

  const error = createBooking.error;
  return (
    <div className="flex flex-col gap-2">
      <FormAlert
        message={error ? (error instanceof ApiError ? error.detail : "Booking failed. Try again.") : null}
      />
      <div className="flex items-end gap-2">
        <div className="flex flex-col gap-1">
          <label htmlFor="seats">Seats</label>
          <select
            id="seats"
            value={seats}
            onChange={(e) => setSeats(Number(e.target.value))}
            className="rounded border border-slate-400 p-2"
          >
            {[1, 2, 3, 4, 5, 6]
              .filter((n) => n <= event.availableSeats)
              .map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
          </select>
        </div>
        <button
          type="button"
          onClick={book}
          disabled={createBooking.isPending}
          className="rounded bg-indigo-700 px-4 py-2 text-white disabled:opacity-60"
        >
          {createBooking.isPending ? "Booking…" : "Book"}
        </button>
      </div>
    </div>
  );
}
