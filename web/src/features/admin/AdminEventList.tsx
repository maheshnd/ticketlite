"use client";
// Admin list of ALL events (drafts too), with an instant publish/unpublish toggle. The toggle is an
// optimistic update: the row changes before the server answers, and rolls back on an error such as a
// 409 version conflict (see useToggleStatus in admin-queries.ts). CONCEPT: optimistic-update
import Link from "next/link";
import { FormAlert } from "../../components/FormAlert";
import { errorMessage } from "../../lib/api-client";
import { useAdminEvents, useToggleStatus } from "./admin-queries";
import { AdminEventTable } from "./AdminEventTable";

export function AdminEventList() {
  const { data: events, error, isPending } = useAdminEvents();
  const toggle = useToggleStatus();

  if (isPending) return <p role="status">Loading events…</p>;
  if (error) return <p role="alert">Could not load events: {error.message}</p>;

  return (
    <div className="flex flex-col gap-4">
      <FormAlert message={errorMessage(toggle.error)} />
      <div className="flex gap-4">
        <Link href="/admin/events/new" className="rounded bg-indigo-700 px-4 py-2 text-white">
          New event
        </Link>
        <Link href="/admin/reports" className="self-center text-indigo-700 underline">
          Reports
        </Link>
      </div>
      <AdminEventTable events={events} onToggle={(event) => toggle.mutate(event)} />
    </div>
  );
}
