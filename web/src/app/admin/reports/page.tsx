// /admin/reports (admins; the data exists only with the optional SQL reporting flag on).
import { PageHeading } from "../../../components/PageHeading";
import { Reports } from "../../../features/admin/Reports";
import { RequireAdmin } from "../../../features/admin/RequireAdmin";

export default function ReportsPage() {
  return (
    <section className="flex flex-col gap-4">
      <PageHeading>Reports</PageHeading>
      <RequireAdmin>
        <Reports />
      </RequireAdmin>
    </section>
  );
}
