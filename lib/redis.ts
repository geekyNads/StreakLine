import { Redis } from "@upstash/redis";

/**
 * Shared Redis client, used for the opt-in leaderboard and (later) any
 * persisted settings. Returns null when Upstash isn't configured, so every
 * caller can degrade gracefully in local dev instead of crashing.
 */
let client: Redis | null = null;

export function isRedisConfigured(): boolean {
  return Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

export function getRedis(): Redis | null {
  if (client) return client;
  if (!isRedisConfigured()) return null;
  client = Redis.fromEnv();
  return client;
}
