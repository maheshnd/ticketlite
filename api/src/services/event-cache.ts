// Cache-aside for the event detail, with stampede protection. CONCEPT: cache-aside, cache-stampede
//   1. look in the cache            -> hit: done (no DynamoDB read)
//   2. miss: take a short lock      -> only ONE request rebuilds the entry...
//   3. ...the others wait 100 ms and look again, instead of all hitting DynamoDB at once
//   4. read DynamoDB, store with a TTL
// The TTL is short (10 s) because seat counts change with every booking; live updates come from AppSync.
import type { Event } from "@ticketlite/shared";
import { getCache } from "../lib/cache";

const TTL_SECONDS = 10;
const key = (eventId: string) => `event:${eventId}`;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function cachedEvent(
  eventId: string,
  load: () => Promise<Event | undefined>,
): Promise<Event | undefined> {
  const cache = await getCache();

  const hit = await cache.get(key(eventId));
  if (hit) return JSON.parse(hit) as Event;

  if (!(await cache.tryLock(`lock:${key(eventId)}`, 3000))) {
    await sleep(100);
    const afterWait = await cache.get(key(eventId));
    if (afterWait) return JSON.parse(afterWait) as Event;
    // Still empty (the rebuilder is slow): read the database ourselves rather than wait longer.
  }

  const event = await load();
  if (event) await cache.set(key(eventId), JSON.stringify(event), TTL_SECONDS);
  await cache.del(`lock:${key(eventId)}`);
  return event;
}

// Invalidation: called after an admin edit, so the next read rebuilds from DynamoDB.
export async function invalidateEvent(eventId: string) {
  await (await getCache()).del(key(eventId));
}
