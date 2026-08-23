import { NextResponse } from "next/server";
import { fetchViewerRepoBreakdown, GitHubApiError } from "@/lib/github";
import { checkRateLimit } from "@/lib/rateLimit";
import { getAuthedUser } from "@/lib/session";

export async function GET(req: Request) {
  const user = await getAuthedUser(req);
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const { success, remaining, reset } = await checkRateLimit(user.login);
  if (!success) {
    return NextResponse.json(
      { error: "Too many requests. Try again shortly." },
      { status: 429, headers: { "Retry-After": Math.max(0, Math.ceil((reset - Date.now()) / 1000)).toString() } }
    );
  }

  try {
    const data = await fetchViewerRepoBreakdown(user.accessToken);
    return NextResponse.json(data, { headers: { "X-RateLimit-Remaining": remaining.toString() } });
  } catch (err) {
    console.error("repo breakdown fetch failed", err);
    const status = err instanceof GitHubApiError ? err.status : 502;
    return NextResponse.json({ error: "Could not load repository breakdown." }, { status });
  }
}
