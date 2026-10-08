"use client";
// /booking?id=... The booking's status, polled until the saga finishes.
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { BookingStatus } from "../../features/bookings/BookingStatus";

function Content() {
  return <BookingStatus bookingId={useSearchParams().get("id") ?? ""} />;
}

export default function BookingPage() {
  return (
    <Suspense fallback={<p role="status">Loading…</p>}>
      <Content />
    </Suspense>
  );
}
