import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { LRUCache } from "lru-cache";

/**
 * Two backends, same interface:
 *
 * 1. Upstash Redis — used automatically when UPSTASH_REDIS_REST_URL /
 *    UPSTASH_REDIS_REST_TOKEN are set. This is the one that actually works
 *    once the app is deployed on more than one server instance (Vercel,
 *    most hosts), since limits have to be shared across instances.
 *
 * 2. In-memory sliding window — automatic fallback so the project runs
 *    with zero external services during local development. NOT sufficient
 *    on its own in a multi-instance production deployment: each instance
 *    would track its own count. Set the Upstash env vars before you
 *    publish this.
 *
 * Two tiers:
 *  - "normal": per signed-in user, for routes that use the visitor's own
 *    GitHub token (contributions, repo breakdown).
 *  - "strict": per IP, for the unauthenticated routes that spend OUR
 *    server token (compare, share card). These are the ones a bad actor
 *    could hit anonymously and in bulk, so they get a much smaller budget.
 */

type Tier = "normal" | "strict";
const TIER_CONFIG: Record<Tier, { limit: number; window: `${number} ${"s" | "m"}` }> = {
  normal: { limit: 20, window: "60 s" },
  strict: { limit: 6, window: "60 s" }
};

const redisLimiters: Partial<Record<Tier, Ratelimit>> = {};
if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
  const redis = Redis.fromEnv();
  for (const tier of Object.keys(TIER_CONFIG) as Tier[]) {
    const { limit, window } = TIER_CONFIG[tier];
    redisLimiters[tier] = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(limit, window),
      analytics: false,
      prefix: `streakline:${tier}`
    });
  }
}

type Hit = { count: number; resetAt: number };
const memoryStores: Record<Tier, LRUCache<string, Hit>> = {
  normal: new LRUCache({ max: 5000, ttl: 60_000 }),
  strict: new LRUCache({ max: 5000, ttl: 60_000 })
};

function memoryLimit(tier: Tier, identifier: string) {
  const { limit } = TIER_CONFIG[tier];
  const store = memoryStores[tier];
  const now = Date.now();
  const existing = store.get(identifier);

  if (!existing || existing.resetAt < now) {
    store.set(identifier, { count: 1, resetAt: now + 60_000 });
    return { success: true, remaining: limit - 1, reset: now + 60_000 };
  }

  if (existing.count >= limit) {
    return { success: false, remaining: 0, reset: existing.resetAt };
  }

  existing.count += 1;
  store.set(identifier, existing);
  return { success: true, remaining: limit - existing.count, reset: existing.resetAt };
}

export async function checkRateLimit(identifier: string, tier: Tier = "normal") {
  const redisLimiter = redisLimiters[tier];
  if (redisLimiter) {
    const { success, remaining, reset } = await redisLimiter.limit(identifier);
    return { success, remaining, reset };
  }
  return memoryLimit(tier, identifier);
}

/** Best-effort client identifier: real IP behind a proxy, else a fallback. */
export function identifierFromRequest(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  const ip = forwarded ? forwarded.split(",")[0]?.trim() : req.headers.get("x-real-ip");
  return ip || "anonymous";
}
