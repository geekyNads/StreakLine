import { getRedis } from "./redis";

const SET_KEY = "streakline:leaderboard";
const META_KEY = "streakline:leaderboard:meta";

export type LeaderboardEntry = {
  login: string;
  streak: number;
  avatarUrl: string;
};

/** Adds/updates the signed-in user's entry. Only ever called with their own login + own data. */
export async function upsertLeaderboardEntry(login: string, streak: number, avatarUrl: string): Promise<void> {
  const redis = getRedis();
  if (!redis) throw new Error("Leaderboard storage is not configured on this server.");
  await Promise.all([
    redis.zadd(SET_KEY, { score: streak, member: login }),
    redis.hset(META_KEY, { [login]: JSON.stringify({ avatarUrl, updatedAt: Date.now() }) })
  ]);
}

export async function removeLeaderboardEntry(login: string): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  await Promise.all([redis.zrem(SET_KEY, login), redis.hdel(META_KEY, login)]);
}

export async function isOnLeaderboard(login: string): Promise<boolean> {
  const redis = getRedis();
  if (!redis) return false;
  const score = await redis.zscore(SET_KEY, login);
  return score !== null;
}

export async function getLeaderboard(limit = 20): Promise<LeaderboardEntry[]> {
  const redis = getRedis();
  if (!redis) return [];

  // withScores, highest streak first.
  const raw = await redis.zrange<string[]>(SET_KEY, 0, limit - 1, { rev: true, withScores: true });

  const entries: LeaderboardEntry[] = [];
  for (let i = 0; i < raw.length; i += 2) {
    const login = raw[i];
    const streak = Number(raw[i + 1]);
    if (!login || Number.isNaN(streak)) continue;
    entries.push({ login, streak, avatarUrl: "" });
  }

  if (entries.length === 0) return [];

  const metas = await redis.hmget<Record<string, string>>(
    META_KEY,
    ...entries.map((e) => e.login)
  );

  return entries.map((e) => {
    const raw = metas?.[e.login];
    if (!raw) return e;
    try {
      const parsed = JSON.parse(raw) as { avatarUrl?: string };
      return { ...e, avatarUrl: parsed.avatarUrl ?? "" };
    } catch {
      return e;
    }
  });
}
