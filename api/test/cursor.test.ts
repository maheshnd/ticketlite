// Cursor encoding: opaque to clients, and rejected cleanly when tampered with.
import { describe, expect, it } from "vitest";
import { decodeCursor, encodeCursor } from "../src/repositories/cursor";

describe("cursor", () => {
  it("round-trips a DynamoDB key", () => {
    const key = { eventId: "evt-1", city: "Pune", startsAt: "2027-02-14T19:30:00Z" };
    expect(decodeCursor(encodeCursor(key)!)).toEqual(key);
  });

  it("returns null when there is no next page", () => {
    expect(encodeCursor(undefined)).toBeNull();
  });

  it("throws a 400 for a cursor that is not valid", () => {
    expect(() => decodeCursor("not-base64-json")).toThrow(expect.objectContaining({ statusCode: 400 }));
    const nested = Buffer.from(JSON.stringify({ a: { b: 1 } })).toString("base64url");
    expect(() => decodeCursor(nested)).toThrow(expect.objectContaining({ statusCode: 400 }));
  });
});
