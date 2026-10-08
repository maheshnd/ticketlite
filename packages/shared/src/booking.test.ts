// Booking schema rules.
import { describe, expect, it } from "vitest";
import { CreateBookingInputSchema, isFinalStatus } from "./booking";

describe("CreateBookingInputSchema", () => {
  it("allows 1 to 6 seats", () => {
    expect(CreateBookingInputSchema.safeParse({ eventId: "evt-1", seats: 6 }).success).toBe(true);
    expect(CreateBookingInputSchema.safeParse({ eventId: "evt-1", seats: 7 }).success).toBe(false);
    expect(CreateBookingInputSchema.safeParse({ eventId: "evt-1", seats: 0 }).success).toBe(false);
  });
});

describe("isFinalStatus", () => {
  it("treats only PENDING as not final", () => {
    expect(isFinalStatus("PENDING")).toBe(false);
    expect(isFinalStatus("CONFIRMED")).toBe(true);
    expect(isFinalStatus("FAILED")).toBe(true);
  });
});
