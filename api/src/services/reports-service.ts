// SQL reports for admins (flag enableSql). Drizzle over the RDS Data API, see packages/sql.
import { bookingsPerDay, createDb, isDatabaseResuming, revenuePerEvent, type Db } from "@ticketlite/sql";
import type { ReportsResponse } from "@ticketlite/shared";
import { HttpError, notFound } from "../errors";
import { config } from "../config";

let db: Db | undefined;

export async function getReports(): Promise<ReportsResponse> {
  if (!config.sql) throw notFound("Reports are disabled (the enableSql flag is off).");
  db ??= createDb(config.sql);
  try {
    const [revenue, perDay] = await Promise.all([revenuePerEvent(db), bookingsPerDay(db)]);
    // PostgreSQL returns SUM/COUNT of numeric as strings (exact decimals); the API sends numbers.
    return {
      revenuePerEvent: revenue.map((r) => ({
        ...r,
        bookings: Number(r.bookings),
        revenue: Number(r.revenue ?? 0),
      })),
      bookingsPerDay: perDay.map((d) => ({ day: d.day, bookings: Number(d.bookings) })),
    };
  } catch (error) {
    // Scale to zero: the paused cluster takes ~15 s to wake up. Tell the client to retry, don't fail.
    if (isDatabaseResuming(error)) {
      throw new HttpError(
        503,
        "Service Unavailable",
        "The reporting database is waking up. Try again in 30 seconds.",
        { "retry-after": "30" },
      );
    }
    throw error;
  }
}
