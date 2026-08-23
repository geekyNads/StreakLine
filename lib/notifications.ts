import { getRedis, isRedisConfigured } from "./redis";

const SUBS_KEY = "streakline:notify:subs"; // login -> JSON { email, unsubToken, subscribedAt }
const TOKEN_KEY = "streakline:notify:tokens"; // unsubToken -> login

export { isRedisConfigured as isNotifyConfigured };

export type Subscription = { login: string; email: string; unsubToken: string; subscribedAt: number };

export async function subscribe(login: string, email: string): Promise<void> {
  const redis = getRedis();
  if (!redis) throw new Error("Notifications are not configured on this server.");

  const unsubToken = crypto.randomUUID();
  const record: Subscription = { login, email, unsubToken, subscribedAt: Date.now() };

  await Promise.all([
    redis.hset(SUBS_KEY, { [login]: JSON.stringify(record) }),
    redis.hset(TOKEN_KEY, { [unsubToken]: login })
  ]);
}

export async function unsubscribe(login: string): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  const existing = await getSubscription(login);
  await redis.hdel(SUBS_KEY, login);
  if (existing) await redis.hdel(TOKEN_KEY, existing.unsubToken);
}

export async function unsubscribeByToken(token: string): Promise<boolean> {
  const redis = getRedis();
  if (!redis) return false;
  const login = await redis.hget<string>(TOKEN_KEY, token);
  if (!login) return false;
  await Promise.all([redis.hdel(SUBS_KEY, login), redis.hdel(TOKEN_KEY, token)]);
  return true;
}

export async function getSubscription(login: string): Promise<Subscription | null> {
  const redis = getRedis();
  if (!redis) return null;
  const raw = await redis.hget<string>(SUBS_KEY, login);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Subscription;
  } catch {
    return null;
  }
}

export async function listSubscriptions(): Promise<Subscription[]> {
  const redis = getRedis();
  if (!redis) return [];
  const all = await redis.hgetall<Record<string, string>>(SUBS_KEY);
  if (!all) return [];
  return Object.values(all)
    .map((raw) => {
      try {
        return JSON.parse(raw) as Subscription;
      } catch {
        return null;
      }
    })
    .filter((s): s is Subscription => s !== null);
}
