// The report queries compile to the SQL we expect (drizzle.mock: no database needed).
import { drizzle } from "drizzle-orm/aws-data-api/pg";
import { describe, expect, it } from "vitest";
import { bookingsPerDay, revenuePerEvent } from "./reports";
import * as schema from "./schema";

const db = drizzle.mock({ database: "x", resourceArn: "x", secretArn: "x", schema }) as never;

describe("reports", () => {
  it("revenue per event JOINs events and only counts confirmed bookings, as a bound parameter", () => {
    const { sql, params } = revenuePerEvent(db).toSQL();
    expect(sql).toContain('inner join "events"');
    expect(sql).toContain('group by "events"."event_id", "events"."name"');
    expect(params).toEqual(["CONFIRMED"]); // never pasted into the SQL text
  });

  it("bookings per day groups by the truncated day", () => {
    expect(bookingsPerDay(db).toSQL().sql).toContain("date_trunc('day'");
  });
});
