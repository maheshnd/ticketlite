"use client";
// /admin/events/edit?id=... Loads the event (strongly consistent, with its version), then the form.
// After a 409, "Reload" refetches the latest version and remounts the form with it (key = version).
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { PageHeading } from "../../../../components/PageHeading";
import { useAdminEvent } from "../../../../features/admin/admin-queries";
import { EventForm } from "../../../../features/admin/EventForm";
import { PosterUpload } from "../../../../features/admin/PosterUpload";
import { RequireAdmin } from "../../../../features/admin/RequireAdmin";

function Content() {
  const eventId = useSearchParams().get("id") ?? "";
  const { data: event, error, isPending, refetch } = useAdminEvent(eventId);
  if (isPending) return <p role="status">Loading event…</p>;
  if (error) return <p role="alert">Could not load the event: {error.message}</p>;
  return (
    <div className="flex flex-col gap-8">
      <EventForm key={event.version} event={event} onConflict={() => void refetch()} />
      <PosterUpload eventId={event.eventId} />
    </div>
  );
}

export default function EditEventPage() {
  return (
    <section className="flex flex-col gap-4">
      <PageHeading>Edit event</PageHeading>
      <RequireAdmin>
        <Suspense fallback={<p role="status">Loading…</p>}>
          <Content />
        </Suspense>
      </RequireAdmin>
    </section>
  );
}
