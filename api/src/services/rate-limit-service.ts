// Sliding-window rate limit per user, in Redis. CONCEPT: rate-limiting
// A sorted set per user holds one entry per attempt (score = time in ms). For each new attempt:
//   drop entries older than the window -> add this one -> count. More than `limit` = 429.
// Unlike a fixed window (e.g. "5 per calendar minute"), there is no burst of 2×limit around the boundary.
// (Other algorithms: token bucket, which API Gateway uses for throttling; leaky bucket; fixed window.)
//
// With the cache flag off there is no Redis, so this check is skipped; API Gateway's per-route throttle
// (infra/http-routes.ts) still protects the bookings route.
import { randomUUID } from "node:crypto";
import { tooManyRequests } from "../errors";
import { getRedis } from "../lib/redis";

export async function checkBookingRateLimit(userId: string, limit = 5, windowMs = 60_000) {
  const redis = await getRedis();
  if (!redis) return;

  const key = `ratelimit:bookings:${userId}`;
  const now = Date.now();
  // MULTI/EXEC: the four commands run together, atomically, in one round trip.
  const results = await redis
    .multi()
    .zremrangebyscore(key, 0, now - windowMs)
    .zadd(key, now, `${now}-${randomUUID()}`)
    .zcard(key)
    .pexpire(key, windowMs)
    .exec()
    .catch(() => null); // Redis down: don't block bookings (fail open)
  const count = Number(results?.[2]?.[1] ?? 0);
  if (count <= limit) return;

  // Retry-After: when the oldest attempt in the window expires.
  const oldest = await redis.zrange(key, "0", "0", "WITHSCORES").catch(() => []);
  const retryAfterMs = Number(oldest[1] ?? now) + windowMs - now;
  throw tooManyRequests(Math.max(1, Math.ceil(retryAfterMs / 1000)));
}
