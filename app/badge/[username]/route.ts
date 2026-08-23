import { fetchPublicUserContributions, GitHubApiError } from "@/lib/github";
import { computeStreaks } from "@/lib/streak";
import { checkRateLimit, identifierFromRequest } from "@/lib/rateLimit";

export const runtime = "edge";

const USERNAME_RE = /^[a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9])){0,38}$/;

function badgeSvg(label: string, value: string, color: string) {
  // Rough character-width estimate so the badge sizes itself to its text,
  // same trick shields.io uses — good enough at this font size/weight.
  const labelWidth = label.length * 6.2 + 20;
  const valueWidth = value.length * 6.6 + 20;
  const width = labelWidth + valueWidth;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="20" role="img" aria-label="${label}: ${value}">
  <linearGradient id="s" x2="0" y2="100%">
    <stop offset="0" stop-color="#fff" stop-opacity=".1"/>
    <stop offset="1" stop-opacity=".1"/>
  </linearGradient>
  <clipPath id="r"><rect width="${width}" height="20" rx="3" fill="#fff"/></clipPath>
  <g clip-path="url(#r)">
    <rect width="${labelWidth}" height="20" fill="#555"/>
    <rect x="${labelWidth}" width="${valueWidth}" height="20" fill="${color}"/>
    <rect width="${width}" height="20" fill="url(#s)"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" font-size="11">
    <text x="${labelWidth / 2}" y="14">${label}</text>
    <text x="${labelWidth + valueWidth / 2}" y="14">${value}</text>
  </g>
</svg>`;
}

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
        // Same reasoning as the full card: short enough to feel live,
        // long enough not to spend the rate-limited server token on every view.
        "Cache-Control": "public, max-age=3600, s-maxage=3600"
      }
    });
  } catch (err) {
    const status = err instanceof GitHubApiError ? err.status : 502;
    const svg = badgeSvg("streak", status === 404 ? "not found" : "error", "#999999");
    return new Response(svg, { status, headers: { "Content-Type": "image/svg+xml" } });
  }
}
