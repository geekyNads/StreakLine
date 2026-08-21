import { NextResponse } from "next/server";
import { fetchPublicUserContributions, GitHubApiError } from "@/lib/github";
import { checkRateLimit, identifierFromRequest } from "@/lib/rateLimit";
import { computeStreaks } from "@/lib/streak";

// GitHub usernames: alphanumeric or single hyphens, 1–39 chars, no leading/trailing hyphen.
const USERNAME_RE = /^[a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9])){0,38}$/;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const username = searchParams.get("username")?.trim() ?? "";

  if (!USERNAME_RE.test(username)) {
    return NextResponse.json({ error: "Enter a valid GitHub username." }, { status: 400 });
  }

  // Strict, IP-based: this route spends OUR server token, not a visitor's
  // own, so it's the one route a bad actor could hit anonymously and in
  // bulk to drain our GitHub API quota. Small budget, on purpose.
  const identifier = identifierFromRequest(req);
  const { success, reset } = await checkRateLimit(identifier, "strict");
  if (!success) {
    return NextResponse.json(
      { error: "Too many requests. Try again shortly." },
      { status: 429, headers: { "Retry-After": Math.max(0, Math.ceil((reset - Date.now()) / 1000)).toString() } }
    );
  }

  try {
    const data = await fetchPublicUserContributions(username);
    const { current, longest } = computeStreaks(data.days);
    return NextResponse.json({
      login: data.login,
      avatarUrl: data.avatarUrl,
      totalContributions: data.totalContributions,
      current,
      longest
    });
  } catch (err) {
    const status = err instanceof GitHubApiError ? err.status : 502;
    if (status >= 500) console.error("compare fetch failed", err);
    const message = status === 404 ? "No GitHub user with that username." : "Could not load that user's data.";
    return NextResponse.json({ error: message }, { status });
  }
}
