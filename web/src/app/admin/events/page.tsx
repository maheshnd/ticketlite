// /admin/events. Admin pages are separate routes, so Next.js puts their code in separate chunks: visitors
// browsing events never download admin code (route-level code splitting). CONCEPT: code-splitting
import { PageHeading } from "../../../components/PageHeading";
import { AdminEventList } from "../../../features/admin/AdminEventList";
import { RequireAdmin } from "../../../features/admin/RequireAdmin";

export default function AdminEventsPage() {
  return (
    <section className="flex flex-col gap-4">
      <PageHeading>Manage events</PageHeading>
      <RequireAdmin>
        <AdminEventList />
      </RequireAdmin>
    </section>
  );
}
