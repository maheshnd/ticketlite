"use client";
// SQL reports (revenue per event, bookings per day). Only available when the optional SQL reporting is on;
// otherwise the API answers 404 and we say why (the page degrades instead of breaking).
// CONCEPT: graceful-degradation
import type { ReportsResponse } from "@ticketlite/shared";
import { useQuery } from "@tanstack/react-query";
import { ApiError, apiFetch, errorMessage } from "../../lib/api-client";
import { formatPrice } from "../../lib/format";
import { adminKeys } from "../../lib/query-keys";

const useReports = () =>
  useQuery({
    queryKey: [...adminKeys.all, "reports"],
    queryFn: () => apiFetch<ReportsResponse>("/api/admin/reports"),
  });

// Accessible tables: a caption, column headers with scope="col", one row per item.
function RevenueTable({ rows }: { rows: ReportsResponse["revenuePerEvent"] }) {
  return (
    <table className="w-full bg-white text-left">
      <caption className="text-left font-semibold">Revenue per event (confirmed bookings)</caption>
      <thead>
        <tr className="border-b">
          <th scope="col" className="p-2">
            Event
          </th>
          <th scope="col" className="p-2">
            Bookings
          </th>
          <th scope="col" className="p-2">
            Revenue
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.eventId} className="border-b">
            <td className="p-2">{row.name}</td>
            <td className="p-2">{row.bookings}</td>
            <td className="p-2">{formatPrice(row.revenue)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function BookingsPerDayTable({ rows }: { rows: ReportsResponse["bookingsPerDay"] }) {
  return (
    <table className="w-full bg-white text-left">
      <caption className="text-left font-semibold">Bookings per day (last 30 days)</caption>
      <thead>
        <tr className="border-b">
          <th scope="col" className="p-2">
            Day
          </th>
          <th scope="col" className="p-2">
            Bookings
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.day} className="border-b">
            <td className="p-2">{row.day}</td>
            <td className="p-2">{row.bookings}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function Reports() {
  const { data, error, isPending } = useReports();

  if (isPending) return <p role="status">Loading reports…</p>;
  if (error instanceof ApiError && error.status === 404) {
    return <p>SQL reporting is switched off in this environment (flag enableSql).</p>;
  }
  if (error) return <p role="alert">{errorMessage(error)}</p>;

  return (
    <div className="flex flex-col gap-8">
      <RevenueTable rows={data.revenuePerEvent} />
      <BookingsPerDayTable rows={data.bookingsPerDay} />
    </div>
  );
}
