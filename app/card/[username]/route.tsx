import { ImageResponse } from "next/og";
import { fetchPublicUserContributions, GitHubApiError } from "@/lib/github";
import { computeStreaks } from "@/lib/streak";
import { checkRateLimit, identifierFromRequest } from "@/lib/rateLimit";

export const runtime = "edge";

const USERNAME_RE = /^[a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9])){0,38}$/;
const LEVEL_COLOR = ["#EBEDF0", "#9BE9A8", "#40C463", "#30A14E", "#216E39"];

function levelFor(count: number, max: number) {
  if (count === 0) return 0;
  if (max <= 0) return 1;
  const ratio = count / max;
  if (ratio > 0.75) return 4;
  if (ratio > 0.5) return 3;
  if (ratio > 0.25) return 2;
  return 1;
}

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

  try {
    const data = await fetchPublicUserContributions(username);
    const { current, longest } = computeStreaks(data.days);
    const recentWeeks = data.weeks.slice(-20);
    const max = Math.max(1, ...recentWeeks.flat().map((d) => d.count));

    return new ImageResponse(
      (
        <div
          style={{
            width: "600px",
            height: "200px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            background: "#FAFAF7",
            padding: "28px 32px",
            fontFamily: "monospace"
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ fontSize: 14, color: "#6B7280" }}>@{data.login}</span>
              <span style={{ fontSize: 32, fontWeight: 600, color: "#14171A", marginTop: 4 }}>
                {current}d streak
              </span>
            </div>
            <span style={{ fontSize: 12, color: "#6B7280" }}>longest: {longest}d · streakline</span>
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
  } catch (err) {
    const status = err instanceof GitHubApiError ? err.status : 502;
    return new Response(status === 404 ? "User not found" : "Could not generate card", { status });
  }
}
