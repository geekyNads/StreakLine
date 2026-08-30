import { ImageResponse } from "next/og";
import { fetchPublicUserContributions, GitHubApiError } from "@/lib/github";
import { computeStreaks } from "@/lib/streak";
import { checkRateLimit, identifierFromRequest } from "@/lib/rateLimit";
import { resolveTheme, levelColors } from "@/lib/cardTheme";
import { levelFor } from "@/lib/heatLevel";

export const runtime = "edge";

const USERNAME_RE = /^[a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9])){0,38}$/;

export async function GET(req: Request, { params }: { params: { username: string } }) {
  const username = params.username?.trim() ?? "";
  if (!USERNAME_RE.test(username)) {
    return new Response("Invalid username", { status: 400 });
  }

  // This endpoint spends OUR server token and can be linked/embedded
  // anywhere (READMEs, social posts), so it gets the strict, per-IP tier.
  const { success } = await checkRateLimit(identifierFromRequest(req), "strict");
  if (!success) {
    return new Response("Too many requests", { status: 429 });
  }

  const { searchParams } = new URL(req.url);
  const theme = resolveTheme(searchParams);
  const LEVEL_COLOR = levelColors(theme);

  try {
    const data = await fetchPublicUserContributions(username);
    const { current, longest } = computeStreaks(data.days);
    const recentWeeks = data.weeks.slice(-20);
    const max = Math.max(1, ...recentWeeks.flat().map((d) => d.count));

    const image = new ImageResponse(
      (
        <div
          style={{
            width: "600px",
            height: "200px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            background: theme.bg,
            padding: "28px 32px",
            fontFamily: "monospace"
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ fontSize: 14, color: theme.muted }}>@{data.login}</span>
              <span style={{ fontSize: 32, fontWeight: 600, color: theme.ink, marginTop: 4 }}>
                {current}d streak
              </span>
            </div>
            <span style={{ fontSize: 12, color: theme.muted }}>longest: {longest}d · streakline</span>
          </div>
          <div style={{ display: "flex", gap: 3 }}>
            {recentWeeks.map((week, wi) => (
              <div key={wi} style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                {week.map((day) => (
                  <div
                    key={day.date}
                    style={{
                      width: 11,
                      height: 11,
                      borderRadius: 2,
                      background: LEVEL_COLOR[levelFor(day.count, max)]
                    }}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      ),
      { width: 600, height: 200 }
    );

    // This is what actually makes the embedded README image "live": GitHub
    // proxies external README images through its own cache (Camo) and
    // honors the origin's Cache-Control. Without this header it falls back
    // to a much longer default. An hour is a deliberate balance — frequent
    // enough that a README genuinely reflects a live streak, not so
    // frequent that every page view against a popular README hits our
    // (rate-limited) server token.
    // GitHub disables JS in rendered READMEs entirely, so an embedded image
    // can never push-update itself with zero reload — that's a platform
    // restriction, not something this cache duration works around. What it
    // DOES control: how current the image is the next time someone loads
    // or reloads the README. 5 minutes is short enough to feel live,
    // long enough not to spend the rate-limited server token on every
    // single pageview of a popular README.
    image.headers.set("Cache-Control", "public, max-age=300, s-maxage=300");
    return image;
  } catch (err) {
    const status = err instanceof GitHubApiError ? err.status : 502;
    return new Response(status === 404 ? "User not found" : "Could not generate card", { status });
  }
}
