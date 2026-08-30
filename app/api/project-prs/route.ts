import { NextResponse } from "next/server";
import { getProjectRepo } from "@/lib/projectRepo";
import { fetchProjectPullRequests, fetchProjectPRCounts } from "@/lib/projectPRs";
import { checkRateLimit, identifierFromRequest } from "@/lib/rateLimit";

export async function GET(req: Request) {
  const repo = getProjectRepo();
  if (!repo) {
    return NextResponse.json({ enabled: false, prs: [], counts: null });
  }

  const { success, reset } = await checkRateLimit(identifierFromRequest(req), "strict");
  if (!success) {
    return NextResponse.json(
      { error: "Too many requests. Try again shortly." },
      { status: 429, headers: { "Retry-After": Math.max(0, Math.ceil((reset - Date.now()) / 1000)).toString() } }
    );
  }

  try {
    const [prs, counts] = await Promise.all([
      fetchProjectPullRequests(repo.owner, repo.repo),
      fetchProjectPRCounts(repo.owner, repo.repo)
    ]);
    return NextResponse.json({ enabled: true, prs, counts });
  } catch (err) {
    console.error("project PR history fetch failed", err);
    return NextResponse.json({ error: "Could not load PR history." }, { status: 502 });
  }
}
