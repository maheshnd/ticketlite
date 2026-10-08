"use client";
// /event?id=evt-001. With a static export there is no server to render /event/evt-001 on demand,
// so the id travels in the query string and the page reads it in the browser.
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { EventDetail } from "../../features/events/EventDetail";

function EventPageContent() {
  const eventId = useSearchParams().get("id") ?? "";
  return <EventDetail eventId={eventId} />;
}

// useSearchParams needs a Suspense boundary in a static export: the HTML is built without a query string.
export default function EventPage() {
  return (
    <Suspense fallback={<p role="status">Loading…</p>}>
      <EventPageContent />
    </Suspense>
  );
}
