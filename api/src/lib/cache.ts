// A tiny cache interface with two implementations. CONCEPT: null-object, caching
//   - RedisCache: the real thing (flag enableCache on).
//   - NoopCache:  same methods, does nothing. Callers never write `if (cacheEnabled)`: with the cache off,
//                 every get is simply a miss.
// Every Redis error is swallowed and treated as a miss: the cache is an optimisation, never a dependency.
// CONCEPT: graceful-degradation
import type Redis from "ioredis";
import { getRedis } from "./redis";

export interface Cache {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds: number): Promise<void>;
  del(key: string): Promise<void>;
  // SET key NX PX: true only for the ONE caller that created the key (used as a short lock).
  tryLock(key: string, ttlMs: number): Promise<boolean>;
}

class RedisCache implements Cache {
  constructor(private readonly redis: Redis) {}
  get = (key: string) => this.redis.get(key).catch(() => null);
  set = async (key: string, value: string, ttlSeconds: number) => {
    await this.redis.set(key, value, "EX", ttlSeconds).catch(() => undefined);
  };
  del = async (key: string) => {
    await this.redis.del(key).catch(() => undefined);
  };
  tryLock = async (key: string, ttlMs: number) =>
    (await this.redis.set(key, "1", "PX", ttlMs, "NX").catch(() => null)) === "OK";
}

export const noopCache: Cache = {
  get: async () => null,
  set: async () => undefined,
  del: async () => undefined,
  tryLock: async () => true, // with no cache there is nothing to stampede on
};

export async function getCache(): Promise<Cache> {
  const redis = await getRedis();
  return redis ? new RedisCache(redis) : noopCache;
}
