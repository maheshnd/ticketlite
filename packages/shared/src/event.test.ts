// Tests for the Event schemas: the rules every package relies on.
import { describe, expect, it } from "vitest";
import { CreateEventInputSchema, UpdateEventInputSchema } from "./event";
import { PageQuerySchema } from "./pagination";

const validInput = {
  name: "Comedy Night",
  description: "Stand-up in Pune",
  city: "Pune",
  venue: "Hard Rock Cafe",
  startsAt: "2027-02-14T19:30:00Z",
  price: 499,
  totalSeats: 100,
  organizerId: "org-1",
  status: "PUBLISHED",
};

describe("CreateEventInputSchema", () => {
  it("accepts a complete event", () => {
    expect(CreateEventInputSchema.safeParse(validInput).success).toBe(true);
  });

  it("rejects a negative price", () => {
    expect(CreateEventInputSchema.safeParse({ ...validInput, price: -1 }).success).toBe(false);
  });

  it("rejects a date that is not ISO 8601", () => {
    expect(CreateEventInputSchema.safeParse({ ...validInput, startsAt: "14/02/2027" }).success).toBe(false);
  });
});

describe("UpdateEventInputSchema", () => {
  it("requires the version the edit was based on", () => {
    expect(UpdateEventInputSchema.safeParse({ name: "New name" }).success).toBe(false);
    expect(UpdateEventInputSchema.safeParse({ name: "New name", version: 3 }).success).toBe(true);
  });
});

describe("PageQuerySchema", () => {
  it("turns the limit from the URL into a number and defaults it to 20", () => {
    expect(PageQuerySchema.parse({ limit: "5" }).limit).toBe(5);
    expect(PageQuerySchema.parse({}).limit).toBe(20);
  });
});
