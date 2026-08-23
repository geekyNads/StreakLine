import { NextResponse } from "next/server";
import { fetchViewerContributions, GitHubApiError } from "@/lib/github";
import { computeStreaks } from "@/lib/streak";
import { checkRateLimit, identifierFromRequest } from "@/lib/rateLimit";
import { getAuthedUser } from "@/lib/session";
import { getLeaderboard, upsertLeaderboardEntry, removeLeaderboardEntry, isOnLeaderboard } from "@/lib/leaderboard";
import { isRedisConfigured } from "@/lib/redis";

const NOT_CONFIGURED = "The leaderboard isn't set up on this server yet — it needs Upstash Redis. See README.";

export async function GET(req: Request) {
  const { success, reset } = await checkRateLimit(identifierFromRequest(req), "strict");
  if (!success) {
    return NextResponse.json(
      { error: "Too many requests. Try again shortly." },
      { status: 429, headers: { "Retry-After": Math.max(0, Math.ceil((reset - Date.now()) / 1000)).toString() } }
    );
  }

  const enabled = isRedisConfigured();
  if (!enabled) {
    return NextResponse.json({ entries: [], optedIn: false, enabled: false });
  }

  const [entries, user] = await Promise.all([getLeaderboard(20), getAuthedUser(req)]);
  const optedIn = user ? await isOnLeaderboard(user.login) : false;
  return NextResponse.json({ entries, optedIn, enabled: true });
}

/** Opt in: recompute the caller's OWN streak server-side from their OWN token — never trust a client-submitted score. */
export async function POST(req: Request) {
  if (!isRedisConfigured()) {
    return NextResponse.json({ error: NOT_CONFIGURED }, { status: 501 });
  }

  const user = await getAuthedUser(req);
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const { success, reset } = await checkRateLimit(user.login);
  if (!success) {
    return NextResponse.json(
      { error: "Too many requests. Try again shortly." },
      { status: 429, headers: { "Retry-After": Math.max(0, Math.ceil((reset - Date.now()) / 1000)).toString() } }
    );
  }

  try {
    const data = await fetchViewerContributions(user.accessToken);
    const { current } = computeStreaks(data.days);
    await upsertLeaderboardEntry(data.login, current, data.avatarUrl);
    return NextResponse.json({ ok: true, streak: current });
  } catch (err) {
    console.error("leaderboard opt-in failed", err);
    const status = err instanceof GitHubApiError ? err.status : 502;
    return NextResponse.json({ error: "Could not join the leaderboard right now." }, { status });
  }
}

export async function DELETE(req: Request) {
  if (!isRedisConfigured()) {
    return NextResponse.json({ error: NOT_CONFIGURED }, { status: 501 });
  }

  const user = await getAuthedUser(req);
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  await removeLeaderboardEntry(user.login);
  return NextResponse.json({ ok: true });
}
