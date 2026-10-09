"use client";
// Shows a booking while the saga runs. The status line is an aria-live region, so screen readers announce
// "Confirmed" (or the failure) the moment polling picks it up. CONCEPT: polling, accessibility
import Link from "next/link";
import { PageHeading } from "../../components/PageHeading";
import { ApiError } from "../../lib/api-client";
import { formatPrice } from "../../lib/format";
import { useBooking } from "./bookings-queries";

const messages = {
  PENDING: "Processing your booking…",
  CONFIRMED: "Confirmed! Enjoy the show.",
  FAILED: "This booking failed. You were not charged.",
  CANCELLED: "This booking was cancelled.",
} as const;

export function BookingStatus({ bookingId }: { bookingId: string }) {
  const { data: booking, error, isPending } = useBooking(bookingId);

  if (isPending) return <p role="status">Loading booking…</p>;
  if (error) {
    const notFound = error instanceof ApiError && error.status === 404;
    return <p role="alert">{notFound ? "This booking does not exist." : error.message}</p>;
  }

  return (
    <section className="flex flex-col gap-3">
      <PageHeading>Booking for {booking.eventName}</PageHeading>
      <p aria-live="polite" role="status" className="text-lg font-semibold">
        {messages[booking.status]}
        {booking.failureReason && ` (${booking.failureReason})`}
      </p>
      <p>
        {booking.seats} seat{booking.seats > 1 ? "s" : ""} · {formatPrice(booking.amount)}
      </p>
      <Link href="/bookings" className="text-indigo-700 underline">
        All my bookings
      </Link>
    </section>
  );
}
