// Tests for the cross-cutting behaviour every route shares: correlation IDs and problem+json errors.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../src/app";

let app: Awaited<ReturnType<typeof buildApp>>;

beforeAll(async () => {
  app = await buildApp();
  // A route that crashes on purpose, to check that internals never leak in a 500.
  app.get("/boom", async () => {
    throw new Error("secret table name ticketlite-events-dev");
  });
});
afterAll(() => app.close());

describe("GET /api/health", () => {
  it("returns 200 and the stage", async () => {
    const res = await app.inject({ method: "GET", url: "/api/health" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: "ok", stage: "test" });
  });
});

describe("correlation id", () => {
  it("echoes a safe incoming x-correlation-id", async () => {
    const res = await app.inject({ url: "/api/health", headers: { "x-correlation-id": "abc-123" } });
    expect(res.headers["x-correlation-id"]).toBe("abc-123");
  });

  it("replaces an unsafe incoming id with a new uuid", async () => {
    const res = await app.inject({
      url: "/api/health",
      headers: { "x-correlation-id": "bad id\nwith newline" },
    });
    expect(res.headers["x-correlation-id"]).toMatch(/^[0-9a-f-]{36}$/);
  });
});

describe("errors", () => {
  it("returns 404 problem+json for an unknown route", async () => {
    const res = await app.inject({ url: "/api/nope" });
    expect(res.statusCode).toBe(404);
    expect(res.headers["content-type"]).toContain("application/problem+json");
    expect(res.json()).toMatchObject({ status: 404, title: "Not Found" });
  });

  it("returns a generic 500 that does not leak the error message", async () => {
    const res = await app.inject({ url: "/boom" });
    expect(res.statusCode).toBe(500);
    expect(res.body).not.toContain("ticketlite-events-dev");
    expect(res.json().correlationId).toBeTruthy();
  });
});
