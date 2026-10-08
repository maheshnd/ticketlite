// toRows: one booking -> an event row + a booking row, money as an exact decimal string.
import { describe, expect, it } from "vitest";
import { toRows } from "./rows";

describe("sql-reporter toRows", () => {
  it("splits the denormalized booking into normalized rows", () => {
    const rows = toRows({
      bookingId: "bk-1",
      userId: "u-1",
      eventId: "evt-1",
      eventName: "Jazz",
      seats: 2,
      amount: 20.1,
      status: "CONFIRMED",
      createdAt: "2026-10-08T10:00:00.000Z",
      updatedAt: "2026-10-08T10:00:00.000Z",
    });
    expect(rows.event).toEqual({ eventId: "evt-1", name: "Jazz" });
    expect(rows.booking.amount).toBe("20.10");
    expect(rows.booking.createdAt).toBeInstanceOf(Date);
  });
});
