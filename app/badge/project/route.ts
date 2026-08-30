import { getProjectRepo } from "@/lib/projectRepo";
import { fetchProjectPRCounts } from "@/lib/projectPRs";
import { checkRateLimit, identifierFromRequest } from "@/lib/rateLimit";
import { badgeSvg } from "@/lib/badgeSvg";

export async function GET(req: Request) {
  const repo = getProjectRepo();
  if (!repo) {
    return new Response(badgeSvg("PRs merged", "not configured", "#999999"), {
      status: 501,
      headers: { "Content-Type": "image/svg+xml" }
    });
  }

  const { success } = await checkRateLimit(identifierFromRequest(req), "strict");
  if (!success) return new Response("Too many requests", { status: 429 });

  try {
    const counts = await fetchProjectPRCounts(repo.owner, repo.repo);
    const svg = badgeSvg("PRs merged", `${counts.merged}`, "#30A14E");
    return new Response(svg, {
      headers: {
        "Content-Type": "image/svg+xml",
        "Cache-Control": "public, max-age=300, s-maxage=300"
      }
    });
  } catch (err) {
    console.error("project badge fetch failed", err);
    const svg = badgeSvg("PRs merged", "error", "#999999");
    return new Response(svg, { status: 502, headers: { "Content-Type": "image/svg+xml" } });
  }
}
