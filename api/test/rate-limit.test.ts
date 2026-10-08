// Sliding-window rate limit: the 6th booking attempt in a minute gets 429 + Retry-After.
import { describe, expect, it, vi } from "vitest";
import * as redisModule from "../src/lib/redis";
import { checkBookingRateLimit } from "../src/services/rate-limit-service";

const fakeRedis = (count: number, oldestMs: number) => {
  const chain = {
    zremrangebyscore: () => chain,
    zadd: () => chain,
    zcard: () => chain,
    pexpire: () => chain,
    exec: async () => [
      [null, 0],
      [null, 1],
      [null, count],
      [null, 1],
    ],
  };
  return { multi: () => chain, zrange: async () => ["x", String(oldestMs)] };
};

describe("checkBookingRateLimit", () => {
  it("allows up to the limit", async () => {
    vi.spyOn(redisModule, "getRedis").mockResolvedValue(fakeRedis(5, Date.now()) as never);
    await expect(checkBookingRateLimit("user-1")).resolves.toBeUndefined();
  });

  it("returns 429 with Retry-After = when the oldest attempt leaves the window", async () => {
    vi.spyOn(redisModule, "getRedis").mockResolvedValue(fakeRedis(6, Date.now() - 50_000) as never);
    await expect(checkBookingRateLimit("user-1")).rejects.toMatchObject({
      statusCode: 429,
      headers: { "retry-after": expect.stringMatching(/^(10|11)$/) },
    });
  });

  it("is skipped when the cache flag is off (no Redis)", async () => {
    vi.spyOn(redisModule, "getRedis").mockResolvedValue(null);
    await expect(checkBookingRateLimit("user-1")).resolves.toBeUndefined();
  });
});
