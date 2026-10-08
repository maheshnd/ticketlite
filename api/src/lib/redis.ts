// The Redis connection (Upstash in AWS, Docker locally), created once per Lambda copy, only when the
// cache flag is on. Returns null when caching is disabled. CONCEPT: connection-reuse, secrets-management
import { getSecret } from "@aws-lambda-powertools/parameters/secrets";
import Redis from "ioredis";
import { config } from "../config";

let connection: Promise<Redis | null> | undefined;

async function connect(): Promise<Redis | null> {
  if (!config.cache.enabled) return null;
  // In AWS the URL (it contains the password) comes from Secrets Manager, cached by Powertools.
  const url =
    config.cache.redisUrl ?? (await getSecret<string>(config.cache.redisSecretArn!, { maxAge: 300 }));
  if (!url) return null;
  return new Redis(url, {
    // Fail fast: a slow cache must never make the API slow. CONCEPT: timeout-chain
    connectTimeout: 1000,
    commandTimeout: 300,
    maxRetriesPerRequest: 1,
  });
}

export function getRedis(): Promise<Redis | null> {
  connection ??= connect().catch(() => null); // can't connect = behave as if caching were off
  return connection;
}
