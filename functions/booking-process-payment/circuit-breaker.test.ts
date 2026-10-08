// The circuit breaker: closed -> open after N failures -> half-open after the wait -> closed on success.
import { describe, expect, it } from "vitest";
import { CircuitBreaker } from "./circuit-breaker";

const fail = () => Promise.reject(new Error("provider down"));
const succeed = () => Promise.resolve("ok");

describe("CircuitBreaker", () => {
  it("opens after 3 failures in a row and then fails fast without calling the provider", async () => {
    let now = 0;
    const breaker = new CircuitBreaker(3, 30_000, () => now);
    for (let i = 0; i < 3; i++) await expect(breaker.call(fail)).rejects.toThrow("provider down");

    expect(breaker.state).toBe("OPEN");
    let called = false;
    await expect(breaker.call(async () => (called = true))).rejects.toMatchObject({ name: "CircuitOpen" });
    expect(called).toBe(false);

    now = 30_000; // the wait is over
    expect(breaker.state).toBe("HALF_OPEN");
    await expect(breaker.call(succeed)).resolves.toBe("ok");
    expect(breaker.state).toBe("CLOSED");
  });

  it("re-opens immediately if the half-open trial call fails", async () => {
    let now = 0;
    const breaker = new CircuitBreaker(1, 1000, () => now);
    await expect(breaker.call(fail)).rejects.toThrow();
    now = 1000;
    await expect(breaker.call(fail)).rejects.toThrow("provider down");
    expect(breaker.state).toBe("OPEN");
  });
});
