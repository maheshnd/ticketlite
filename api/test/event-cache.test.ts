// Cache-aside with stampede protection, against an in-memory fake cache.
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as cacheModule from "../src/lib/cache";
import { cachedEvent } from "../src/services/event-cache";
import { sampleEvent } from "./fixtures";

const store = new Map<string, string>();
const fakeCache: cacheModule.Cache = {
  get: async (k) => store.get(k) ?? null,
  set: async (k, v) => void store.set(k, v),
  del: async (k) => void store.delete(k),
  tryLock: async (k) => (store.has(k) ? false : (store.set(k, "1"), true)),
};
vi.spyOn(cacheModule, "getCache").mockResolvedValue(fakeCache);
beforeEach(() => store.clear());

describe("cachedEvent", () => {
  it("reads the database on a miss, then serves the next read from the cache", async () => {
    const load = vi.fn(async () => sampleEvent);
    await cachedEvent("evt-1", load);
    await cachedEvent("evt-1", load);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("lets only the lock holder rebuild; a concurrent request waits and reuses its result", async () => {
    store.set("lock:event:evt-1", "1"); // someone else is rebuilding...
    setTimeout(() => store.set("event:evt-1", JSON.stringify(sampleEvent)), 20); // ...and finishes soon
    const load = vi.fn(async () => sampleEvent);
    expect(await cachedEvent("evt-1", load)).toEqual(sampleEvent);
    expect(load).not.toHaveBeenCalled();
  });
});
