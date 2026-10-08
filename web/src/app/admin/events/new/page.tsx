// /admin/events/new
import { PageHeading } from "../../../../components/PageHeading";
import { EventForm } from "../../../../features/admin/EventForm";
import { RequireAdmin } from "../../../../features/admin/RequireAdmin";

export default function NewEventPage() {
  return (
    <section className="flex flex-col gap-4">
      <PageHeading>New event</PageHeading>
      <RequireAdmin>
        <EventForm />
      </RequireAdmin>
    </section>
  );
}
