import { ImageResponse } from "next/og";
import { getLeaderboard } from "@/lib/leaderboard";
import { isRedisConfigured } from "@/lib/redis";
import { resolveTheme } from "@/lib/cardTheme";
import { checkRateLimit, identifierFromRequest } from "@/lib/rateLimit";

export const runtime = "edge";

export async function GET(req: Request) {
  const { success } = await checkRateLimit(identifierFromRequest(req), "strict");
  if (!success) {
    return new Response("Too many requests", { status: 429 });
  }

  if (!isRedisConfigured()) {
    return new Response("Leaderboard is not configured on this server", { status: 501 });
  }

  const { searchParams } = new URL(req.url);
  const theme = resolveTheme(searchParams);
  const limit = Math.min(10, Math.max(1, Number(searchParams.get("limit")) || 5));

  const entries = await getLeaderboard(limit);
  const rowHeight = 42;
  const height = 60 + entries.length * rowHeight + (entries.length === 0 ? 40 : 0);

  const image = new ImageResponse(
    (
      <div
        style={{
          width: "500px",
          height: `${height}px`,
          display: "flex",
          flexDirection: "column",
          background: theme.bg,
          padding: "24px 28px",
          fontFamily: "monospace"
        }}
      >
        <span style={{ fontSize: 12, color: theme.muted, letterSpacing: 1, textTransform: "uppercase" }}>
          streakline leaderboard
        </span>

        {entries.length === 0 && (
          <span style={{ fontSize: 13, color: theme.muted, marginTop: 20 }}>No one's opted in yet.</span>
        )}

        <div style={{ display: "flex", flexDirection: "column", marginTop: 12 }}>
          {entries.map((entry, i) => (
            <div
              key={entry.login}
              style={{
                display: "flex",
                alignItems: "center",
                height: `${rowHeight}px`,
                borderTop: i === 0 ? "none" : `1px solid ${theme.muted}22`
              }}
            >
              <span style={{ width: 24, fontSize: 13, color: theme.muted }}>{i + 1}</span>
              {entry.avatarUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={entry.avatarUrl}
                  width={22}
                  height={22}
                  style={{ borderRadius: "50%", marginRight: 10 }}
                  alt=""
                />
              )}
              <span style={{ flex: 1, fontSize: 14, color: theme.ink }}>@{entry.login}</span>
              <span style={{ fontSize: 14, color: theme.accent, fontWeight: 600 }}>{entry.streak}d</span>
            </div>
          ))}
        </div>
      </div>
    ),
    { width: 500, height }
  );

  // Shorter than the per-user card (1h): the whole point of this endpoint
  // is showing how the leaderboard changes as people join and update, so
  // it should refresh more often. Still cached — this reads from Redis on
  // every request, so an unbounded refresh rate is still worth avoiding.
  // Same platform constraint as the per-user card: no README embed can be
  // truly live (GitHub disables JS there), so this is the freshness ceiling
  // for the next reload, not a push mechanism. Shorter than the per-user
  // card since this reads from Redis, not the GitHub API — cheap enough to
  // refresh more often.
  image.headers.set("Cache-Control", "public, max-age=180, s-maxage=180");
  return image;
}
