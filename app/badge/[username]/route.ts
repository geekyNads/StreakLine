import { fetchPublicUserContributions, GitHubApiError } from "@/lib/github";
import { computeStreaks } from "@/lib/streak";
import { checkRateLimit, identifierFromRequest } from "@/lib/rateLimit";
import { badgeSvg } from "@/lib/badgeSvg";

export const runtime = "edge";

const USERNAME_RE = /^[a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9])){0,38}$/;

export async function GET(req: Request, { params }: { params: { username: string } }) {
  const username = params.username?.trim() ?? "";
  if (!USERNAME_RE.test(username)) {
    return new Response("Invalid username", { status: 400 });
  }

  const { success } = await checkRateLimit(identifierFromRequest(req), "strict");
  if (!success) {
    return new Response("Too many requests", { status: 429 });
  }

  const { searchParams } = new URL(req.url);
  const metric = searchParams.get("metric") === "longest" ? "longest" : "current";

  try {
    const data = await fetchPublicUserContributions(username);
    const { current, longest } = computeStreaks(data.days);
    const value = metric === "longest" ? longest : current;
    const label = metric === "longest" ? "longest streak" : "streak";
    const color = value > 0 ? "#30A14E" : "#6B7280";

    const svg = badgeSvg(label, `${value}d`, color);

    return new Response(svg, {
      headers: {
        "Content-Type": "image/svg+xml",
        // See app/card/[username]/route.tsx for why this is 5 minutes, not
        // shorter: it's the freshness ceiling for the next reload, not a
        // live-push mechanism — GitHub disables JS in rendered READMEs.
        "Cache-Control": "public, max-age=300, s-maxage=300"
      }
    });
  } catch (err) {
    const status = err instanceof GitHubApiError ? err.status : 502;
    const svg = badgeSvg("streak", status === 404 ? "not found" : "error", "#999999");
    return new Response(svg, { status, headers: { "Content-Type": "image/svg+xml" } });
  }
}
