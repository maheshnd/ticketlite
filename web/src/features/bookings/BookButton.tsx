"use client";
// The "Book" control on the event page: pick 1-6 seats, then book. Anonymous users get a login link.
// The booking logic (with its Idempotency-Key) lives in use-book-event.ts.
import type { Event } from "@ticketlite/shared";
import Link from "next/link";
import { useState } from "react";
import { FormAlert } from "../../components/FormAlert";
import { errorMessage } from "../../lib/api-client";
import { useAuth } from "../auth/auth-context";
import { useBookEvent } from "./use-book-event";

// A labelled select with 1..6 seats, never more than are left.
function SeatPicker({
  max,
  value,
  onChange,
}: {
  max: number;
  value: number;
  onChange: (seats: number) => void;
}) {
  const options = [1, 2, 3, 4, 5, 6].filter((n) => n <= max);
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor="seats">Seats</label>
      <select
        id="seats"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="rounded border border-slate-400 p-2"
      >
        {options.map((n) => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
      </select>
    </div>
  );
}

export function BookButton({ event }: { event: Event }) {
  const { status } = useAuth();
  const [seats, setSeats] = useState(1);
  const { book, isPending, error } = useBookEvent(event.eventId);

  if (status !== "authenticated") {
    return (
      <Link href="/login" className="self-start rounded bg-indigo-700 px-4 py-2 text-white">
        Log in to book
      </Link>
    );
  }
  if (event.availableSeats === 0) return <p className="font-medium">Sold out</p>;

  return (
    <div className="flex flex-col gap-2">
      <FormAlert message={errorMessage(error, "Booking failed. Try again.")} />
      <div className="flex items-end gap-2">
        <SeatPicker max={event.availableSeats} value={seats} onChange={setSeats} />
        <button
          type="button"
          onClick={() => book(seats)}
          disabled={isPending}
          className="rounded bg-indigo-700 px-4 py-2 text-white disabled:opacity-60"
        >
          {isPending ? "Booking…" : "Book"}
        </button>
      </div>
    </div>
  );
}
