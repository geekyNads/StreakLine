#!/usr/bin/env bash
set -e
echo "Writing 40 files..."

cat > ".env.example" << 'STREAKLINE_EOF'
# --- GitHub OAuth App ---
# Create one at https://github.com/settings/developers
# Homepage URL:      http://localhost:3000 (or your deployed URL)
# Callback URL:       http://localhost:3000/api/auth/callback/github
GITHUB_ID=
GITHUB_SECRET=

# --- NextAuth ---
# Generate with: openssl rand -base64 32
NEXTAUTH_SECRET=
NEXTAUTH_URL=http://localhost:3000

# --- Public data token (compare-with-a-friend + shareable card) ---
# These two features look up OTHER people's public GitHub activity, which
# needs a token even though the data itself is public. Use a Fine-grained
# Personal Access Token at https://github.com/settings/personal-access-tokens
# with NO repository access and NO account permissions selected — it only
# needs to exist to authenticate the request. Keep this separate from your
# own OAuth login; if it leaks, rotate it — it can't do anything privileged,
# but it should still be treated as a secret.
# Leave blank to disable both features; they'll return a clear 501 instead
# of crashing.
GITHUB_PUBLIC_DATA_TOKEN=

# --- Project changelog (optional feature) ---
# Shows this project's OWN pull request history at /changelog, plus a
# "PRs merged" badge at /badge/project — reuses GITHUB_PUBLIC_DATA_TOKEN
# above. Format: owner/repo. Leave blank to hide the feature entirely.
GITHUB_PROJECT_REPO=

# --- Rate limiting & leaderboard storage (required before you publish) ---
# Create a free Redis DB at https://console.upstash.com and paste the
# REST credentials below. Without these:
#  - rate limiting falls back to an in-memory limiter that only works
#    correctly on a single server instance
#  - the leaderboard feature is disabled (join/leave requests return an
#    error instead of silently no-opting)
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=

# --- Email notifications (optional feature) ---
# "Email me if my streak is at risk" checkbox on the dashboard needs both
# of these. Leave either blank and the checkbox simply doesn't appear.
#
# 1. Create a free account at https://resend.com and generate an API key.
#    Their sandbox sender (onboarding@resend.dev) works for testing without
#    verifying a domain; for real use, verify your own domain in Resend and
#    set NOTIFY_FROM_EMAIL to an address on it.
RESEND_API_KEY=
NOTIFY_FROM_EMAIL=streakline <onboarding@resend.dev>
#
# 2. A secret only your own cron job knows, so /api/cron/streak-risk can't
#    be triggered by anyone who finds the URL. Generate with:
#    openssl rand -base64 32
# Set this in Vercel's environment variables — Vercel automatically sends
# it as a Bearer token when invoking scheduled functions defined in
# vercel.json, no extra configuration needed on your end.
CRON_SECRET=
STREAKLINE_EOF

cat > "README.md" << 'STREAKLINE_EOF'
# streakline

A minimal, secure GitHub streak & contribution viewer. Connect your GitHub
account to see your streak, contribution graph, language breakdown, and
more — with nothing stored unless you choose to share it.

## Features

- Current streak, longest streak, and a self-drawn contribution graph —
  refreshes in the background every 2 minutes while the dashboard is open,
  no manual reload needed
- Optional "grace day" tolerance so one missed day doesn't zero out a streak
  (stored only in your browser, opt-in)
- Streak-length-over-time chart, weekly trend, and monthly insights
- Streak milestones (1 week → 1 year), derived from data already fetched
- Language and repository-activity breakdown, derived from your commit activity
- A public, shareable streak card (PNG) with theme presets and custom colors,
  plus a small embeddable SVG badge — both cache-controlled so a README
  embed actually reflects a live streak, not a stale snapshot
- A public leaderboard image (PNG) for README embedding, refreshed every 10
  minutes — same theming, no GitHub API call behind it since leaderboard
  data is already stored opt-in
- Compare your streak against any public GitHub username
- An opt-in public leaderboard, live on the dashboard (background refresh
  every minute, paused when the tab isn't visible)
- Optional email reminder when your streak hasn't been logged yet today
  (checks public contribution data only — never stores your GitHub token)
- Dark mode, installable as a PWA
- Two-tier rate limiting so the app can't be turned into a free proxy for
  hammering GitHub's API

## Stack

- Next.js 14 (App Router) + TypeScript
- NextAuth.js for GitHub OAuth
- Tailwind for styling, `next/og` for the share-card image
- Upstash Redis (with in-memory fallback) for rate limiting, leaderboard, and notification storage
- Resend for email, Vercel Cron for the daily streak-risk check

## Setup

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Create a GitHub OAuth App** at https://github.com/settings/developers → *New OAuth App*.

   - Homepage URL: `http://localhost:3000`
   - Authorization callback URL: `http://localhost:3000/api/auth/callback/github`

   Copy the client ID and generate a client secret.

3. **Copy `.env.example` to `.env.local`** and fill in the required values
   (see comments in that file for each one — GitHub OAuth credentials and
   `NEXTAUTH_SECRET` are required; everything else is an optional feature
   flag, see below).

4. **Run it**

   ```bash
   npm run dev
   ```

## Feature flags via environment variables

Every optional feature degrades gracefully without its env vars — the UI
hides or returns a clear "not configured" response instead of crashing:

- **Compare + shareable card + badge** need `GITHUB_PUBLIC_DATA_TOKEN` (a
  zero-permission personal access token — see `.env.example`).
- **Leaderboard** needs Upstash Redis.
- **Email notifications** need `RESEND_API_KEY`, `NOTIFY_FROM_EMAIL`, Upstash
  Redis (for storing opt-ins), and `CRON_SECRET` (for the scheduled check
  defined in `vercel.json`) — see `.env.example` for the full setup.

## Before you publish this

1. **Set up Upstash Redis.** Required for the leaderboard, and strongly
   recommended for rate limiting — the in-memory fallback only tracks
   requests within a single running process, so on a multi-instance host
   it's trivially bypassed. Create a free database at
   https://console.upstash.com and set `UPSTASH_REDIS_REST_URL` /
   `UPSTASH_REDIS_REST_TOKEN` in production.

2. **Create the public-data token deliberately, with zero permissions.**
   See the comment in `.env.example`. If you don't want the compare/share
   features at all, just leave it blank.

3. **Update the GitHub OAuth App's URLs** to your real domain, and set
   `NEXTAUTH_URL` accordingly.

4. **Set a fresh `NEXTAUTH_SECRET`** in production — don't reuse the local one.

5. **Serve over HTTPS.** The session cookie is `secure` and uses the
   `__Host-` prefix in production (`lib/auth.ts`), which browsers silently
   refuse to set over plain HTTP.

6. **Run `npm audit`** and check `SECURITY.md` for currently-known,
   documented trade-offs before going live — including one open item
   about Next.js 14.x advisories that's tracked there rather than hidden.

7. **Review `SECURITY.md`** in full — it maps out exactly what data goes
   where, and which pieces are the highest-risk surface (the two
   unauthenticated routes).

## How the security holds together

- **Minimal OAuth scope.** Only `read:user` — no repo, org, or write access.
- **Your GitHub token never reaches the browser.** It lives only inside
  the encrypted (JWE) session cookie and is decrypted server-side only,
  via `lib/session.ts`. The `session` callback in `lib/auth.ts`
  deliberately omits it from what's handed to client components.
- **Queries use `viewer`, not a passed-in username**, for anything backed
  by your own token — so your token can only ever read your own profile.
- **The two public routes (compare, share card) use a separate,
  intentionally zero-permission server token** — never your visitors'
  tokens — and carry their own, stricter, per-IP rate limit specifically
  because they're the one surface an anonymous visitor can hit in bulk.
- **The leaderboard never trusts a client-submitted score.** Opting in
  re-fetches and recomputes the streak server-side from the caller's own
  token before writing anything.
- **Nothing is persisted** except the leaderboard, which is opt-in,
  removable at any time, and stores only what's already public on GitHub.
- **Security headers** (`next.config.mjs`): strict Content-Security-Policy
  (the one inline script — theme init — is allowlisted by exact SHA-256
  hash, not a blanket `unsafe-inline`), HSTS, no framing, disabled unused
  browser features.
- **Errors are opaque to the client** — logged server-side only.
- See `SECURITY.md` for the full data map and documented trade-offs.

## Project structure

```
app/
  page.tsx                     landing page + sign-in
  dashboard/
    page.tsx                   server shell, redirects if signed out
    DashboardData.tsx          client component: fetches + renders everything
  card/[username]/route.tsx    public shareable PNG card (next/og, edge)
  api/
    auth/[...nextauth]/        NextAuth route handler
    contributions/             rate-limited data endpoint (own token)
    repo-breakdown/            language/repo breakdown (own token)
    compare/                   public lookup of another user (server token)
    leaderboard/                GET list, POST join, DELETE leave
components/
  ContributionGraph.tsx        custom-drawn SVG contribution grid
  StreakHistoryChart.tsx       streak-over-time sparkline
  LanguageBreakdown.tsx, TopRepos.tsx
  ShareCard.tsx, CompareWidget.tsx, Leaderboard.tsx
  ThemeProvider.tsx, ThemeToggle.tsx
  GraceDayToggle.tsx           client-only preference (localStorage)
  CountUp.tsx, DashboardSkeleton.tsx
  SignInButton.tsx, SignOutButton.tsx
lib/
  auth.ts                      NextAuth config
  session.ts                   shared "get authed user" helper for API routes
  github.ts                    GitHub GraphQL client (own-token + server-token paths)
  streak.ts                    streak + streak-history calculation
  leaderboard.ts                Redis-backed opt-in leaderboard storage
  redis.ts                     shared Redis client (null when unconfigured)
  rateLimit.ts                  two-tier Redis + in-memory rate limiter
middleware.ts                  IP rate limit on auth endpoints
SECURITY.md                    data map, threat notes, reporting instructions
```
STREAKLINE_EOF

cat > "SECURITY.md" << 'STREAKLINE_EOF'
# Security Policy

## Reporting a vulnerability

Please report security issues privately rather than opening a public issue:
GitHub Security Advisories → **Report a vulnerability** on this repo's
Security tab. If that's not available, open an issue asking for a private
contact channel rather than describing the vulnerability directly.

## What this app touches, and how

For anyone auditing this before deploying it themselves:

| Data | Where it lives | Notes |
|---|---|---|
| GitHub OAuth access token (your own login) | Encrypted (JWE) `httpOnly` session cookie | Never sent to the browser as readable JSON — see `lib/auth.ts` and `lib/session.ts` |
| `GITHUB_PUBLIC_DATA_TOKEN` (server-owned) | Environment variable only | Used solely for looking up *other* public GitHub users' public data (compare, share card). Give it zero scopes/permissions when you create it — see `.env.example` |
| Leaderboard entries | Redis (Upstash), opt-in only | Username, current streak, avatar URL — all already public on the user's GitHub profile. Removed immediately on opt-out |
| Contribution/streak data | Never persisted | Fetched fresh per request |
| Email notification opt-ins | Redis (Upstash), opt-in only | Email address + GitHub username + a random unsubscribe token. Removed immediately on opt-out or via the one-click unsubscribe link in every reminder email |
| `RESEND_API_KEY` / `CRON_SECRET` (server-owned) | Environment variable only | The cron job checks streak risk using `GITHUB_PUBLIC_DATA_TOKEN` (public data only) — it never touches a subscriber's personal OAuth token, because it doesn't need to and never stores one |

## Known trade-offs (by design, documented rather than hidden)

- **`npm audit` currently reports high-severity advisories against Next.js
  14.x** (Server Actions DoS/SSRF, middleware cache poisoning, and others).
  The fix requires a major-version jump to Next 15/16, which isn't done
  automatically here since it can be a breaking change worth testing on
  its own. Two things reduce actual exposure in this codebase specifically:
  it doesn't use Server Actions (`'use server'`) anywhere, and it doesn't
  use `next/image` (avatars render as plain `<img>`), which is where a
  chunk of these CVEs live. Still — run `npm audit` yourself before
  deploying, and plan the Next 15/16 upgrade; don't take this project's
  word for it being fine forever. Dependabot (`.github/dependabot.yml`) is
  already wired up to flag new ones.
- **JWT session strategy.** The access token round-trips through an
  encrypted browser cookie rather than staying purely server-side in a
  database session. This is standard NextAuth practice and the cookie is
  `httpOnly`, `secure`, and `sameSite=lax`, but if you want the token to
  never touch the browser at all, swap to a database session adapter.
- **In-memory rate-limit fallback.** Without Upstash Redis configured,
  rate limits are per-instance, not global. Fine for local dev; not fine
  for a multi-instance production deployment. See the README.
- **The public compare/share-card routes spend a server-owned token.**
  They're deliberately rate-limited far more strictly (per-IP, 6 req/min)
  than the authenticated routes, since they're the one path an anonymous
  visitor can hit in bulk.

## Before deploying your own copy

See the "Before you publish this" checklist in `README.md`.
STREAKLINE_EOF

cat > "vercel.json" << 'STREAKLINE_EOF'
{
  "crons": [
    {
      "path": "/api/cron/streak-risk",
      "schedule": "0 20 * * *"
    }
  ]
}
STREAKLINE_EOF

mkdir -p "app/card/[username]"
cat > "app/card/[username]/route.tsx" << 'STREAKLINE_EOF'
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
STREAKLINE_EOF

mkdir -p "app/dashboard"
cat > "app/dashboard/DashboardData.tsx" << 'STREAKLINE_EOF'
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ContributionGraph } from "@/components/ContributionGraph";
import { StreakHistoryChart } from "@/components/StreakHistoryChart";
import { LanguageBreakdown } from "@/components/LanguageBreakdown";
import { TopRepos } from "@/components/TopRepos";
import { ShareCard } from "@/components/ShareCard";
import { CompareWidget } from "@/components/CompareWidget";
import { Leaderboard } from "@/components/Leaderboard";
import { CountUp } from "@/components/CountUp";
import { DashboardSkeleton } from "@/components/DashboardSkeleton";
import { GraceDayToggle, useGraceDays } from "@/components/GraceDayToggle";
import { Milestones } from "@/components/Milestones";
import { MonthlyInsights } from "@/components/MonthlyInsights";
import { WeeklyTrend } from "@/components/WeeklyTrend";
import { NotifyCheckbox } from "@/components/NotifyCheckbox";
import { LiveIndicator } from "@/components/LiveIndicator";
import { usePolling } from "@/hooks/usePolling";
import { computeStreaks, computeWeeklyStreakHistory } from "@/lib/streak";
import { computeMilestoneStatus, nextMilestone } from "@/lib/milestones";
import { computeMonthlySummaries, computeWeeklySummaries } from "@/lib/insights";
import type { ContributionData, RepoBreakdown } from "@/lib/github";

type ContribState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; data: ContributionData };

type RepoState = { status: "loading" | "error" | "ready"; data?: RepoBreakdown };

// How often the dashboard quietly refreshes itself. Streak data doesn't
// change second to second, so this favors not wasting GitHub API calls
// over shaving the delay down further — polling only runs while the tab
// is actually visible anyway (see usePolling).
const REFRESH_INTERVAL_MS = 120_000;

export function DashboardData() {
  const [contrib, setContrib] = useState<ContribState>({ status: "loading" });
  const [repos, setRepos] = useState<RepoState>({ status: "loading" });
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [graceDays, setGraceDays] = useGraceDays();
  const hasLoadedOnce = useRef(false);

  const loadContributions = useCallback(async (isBackground: boolean) => {
    if (!isBackground) setContrib({ status: "loading" });
    try {
      const res = await fetch("/api/contributions");
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Something went wrong.");
      }
      const data: ContributionData = await res.json();
      setContrib({ status: "ready", data });
      setLastUpdated(Date.now());
    } catch (err) {
      // A background refresh failing shouldn't blow away a working
      // dashboard — only the initial load surfaces a full error state.
      if (!isBackground) setContrib({ status: "error", message: (err as Error).message });
    }
  }, []);

  const loadRepos = useCallback(async () => {
    try {
      const res = await fetch("/api/repo-breakdown");
      if (!res.ok) throw new Error();
      const data: RepoBreakdown = await res.json();
      setRepos({ status: "ready", data });
    } catch {
      setRepos((prev) => (prev.status === "ready" ? prev : { status: "error" }));
    }
  }, []);

  useEffect(() => {
    loadContributions(false);
    loadRepos();
    hasLoadedOnce.current = true;
  }, [loadContributions, loadRepos]);

  usePolling(() => loadContributions(true), REFRESH_INTERVAL_MS);
  usePolling(loadRepos, REFRESH_INTERVAL_MS);

  if (contrib.status === "loading") return <DashboardSkeleton />;

  if (contrib.status === "error") {
    return (
      <div className="mt-10">
        <p className="font-mono text-sm text-graphite">{contrib.message}</p>
        <button
          onClick={() => loadContributions(false)}
          className="mt-3 font-mono text-xs underline decoration-hairline underline-offset-4 hover:text-ink dark:hover:text-paper"
        >
          try again
        </button>
      </div>
    );
  }

  const { data } = contrib;
  const { current, longest } = computeStreaks(data.days, graceDays);
  const history = computeWeeklyStreakHistory(data.weeks, graceDays);
  const milestones = computeMilestoneStatus(current, longest);
  const upNext = nextMilestone(current);
  const months = computeMonthlySummaries(data.days);
  const weeks = computeWeeklySummaries(data.weeks);

  return (
    <div className="mt-10 space-y-12 sm:space-y-14">
      <section>
        <div className="flex items-center justify-between">
          <div className="grid flex-1 grid-cols-1 gap-6 font-mono sm:grid-cols-3">
            <Stat label="current streak" value={current} suffix="d" />
            <Stat label="longest streak" value={longest} suffix="d" />
            <Stat label="past year" value={data.totalContributions} suffix="" />
          </div>
        </div>
        <div className="mt-6 flex flex-wrap items-center gap-4">
          <GraceDayToggle value={graceDays} onChange={setGraceDays} />
          <NotifyCheckbox />
          <LiveIndicator lastUpdated={lastUpdated} />
        </div>
      </section>

      <section>
        <SectionHeading>milestones</SectionHeading>
        <div className="mt-4">
          <Milestones
            milestones={milestones}
            upNext={upNext ? `${upNext.daysRemaining}d to ${upNext.milestone.label}` : "all milestones reached"}
          />
        </div>
      </section>

      <section>
        <SectionHeading>contribution graph</SectionHeading>
        <div className="mt-4">
          <ContributionGraph weeks={data.weeks} />
        </div>
      </section>

      <section>
        <SectionHeading>streak over time</SectionHeading>
        <div className="mt-4">
          <StreakHistoryChart points={history} />
        </div>
      </section>

      <section>
        <SectionHeading>monthly insights</SectionHeading>
        <div className="mt-4 space-y-3">
          <WeeklyTrend weekly={weeks} />
          <MonthlyInsights months={months} />
        </div>
      </section>

      {repos.status === "ready" && repos.data && repos.data.languages.length > 0 && (
        <section>
          <SectionHeading>languages</SectionHeading>
          <div className="mt-4">
            <LanguageBreakdown data={repos.data} />
          </div>
        </section>
      )}

      {repos.status === "ready" && repos.data && repos.data.repos.length > 0 && (
        <section>
          <SectionHeading>repository activity</SectionHeading>
          <div className="mt-4 overflow-x-auto">
            <TopRepos data={repos.data} />
          </div>
        </section>
      )}

      <section>
        <SectionHeading>share your streak</SectionHeading>
        <div className="mt-4">
          <ShareCard login={data.login} />
        </div>
      </section>

      <section>
        <SectionHeading>compare with a friend</SectionHeading>
        <div className="mt-4">
          <CompareWidget self={{ login: data.login, current, longest }} />
        </div>
      </section>

      <section>
        <SectionHeading>leaderboard</SectionHeading>
        <div className="mt-4">
          <Leaderboard />
        </div>
      </section>
    </div>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="border-t border-hairline pt-6 font-mono text-xs uppercase tracking-tightest text-graphite dark:border-white/10">
      {children}
    </h2>
  );
}

function Stat({ label, value, suffix }: { label: string; value: number; suffix: string }) {
  return (
    <div>
      <div className="text-3xl font-semibold tracking-tightest">
        <CountUp value={value} />
        <span className="text-lg text-graphite">{suffix}</span>
      </div>
      <div className="mt-1 text-xs text-graphite">{label}</div>
    </div>
  );
}
STREAKLINE_EOF

mkdir -p "app/dashboard"
cat > "app/dashboard/page.tsx" << 'STREAKLINE_EOF'
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { SignOutButton } from "@/components/SignOutButton";
import { ThemeToggle } from "@/components/ThemeToggle";
import { DashboardData } from "./DashboardData";

export default async function Dashboard() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/");

  const login = (session.user as { login?: string } | undefined)?.login;

  return (
    <main className="mx-auto max-w-2xl px-4 py-10 sm:px-6 sm:py-16">
      <header className="flex items-center justify-between border-b border-hairline pb-6 dark:border-white/10">
        <div className="flex items-center gap-3">
          {session.user?.image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={session.user.image} alt="" width={32} height={32} className="rounded-full" />
          )}
          <span className="font-mono text-sm">@{login}</span>
        </div>
        <div className="flex items-center gap-4">
          <ThemeToggle />
          <SignOutButton />
        </div>
      </header>

      <DashboardData />
    </main>
  );
}
STREAKLINE_EOF

mkdir -p "app"
cat > "app/layout.tsx" << 'STREAKLINE_EOF'
import type { Metadata } from "next";
import { headers } from "next/headers";
import { IBM_Plex_Mono, Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-mono"
});

const sans = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans"
});

export const metadata: Metadata = {
  title: "streakline — your GitHub streak, plainly",
  description: "Connect GitHub and see your commit streak and contribution graph. Nothing stored, nothing shared.",
  robots: { index: true, follow: true },
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" }
    ],
    apple: "/icon-192.png"
  }
};

export const viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FAFAF7" },
    { media: "(prefers-color-scheme: dark)", color: "#14171A" }
  ]
};

// Reads the saved theme before first paint, so there's no flash of the
// wrong theme on load. Carries the per-request nonce set by middleware.ts —
// NOT a hash allowlist, because that only works for scripts whose content
// never changes, and this needs to coexist with Next's own hydration
// scripts, which do change on every build.
const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem('streakline-theme');if(!t){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}if(t==='dark'){document.documentElement.classList.add('dark');}}catch(e){}})();`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  return (
    <html lang="en" className={`${mono.variable} ${sans.variable}`} suppressHydrationWarning>
      <head>
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="bg-paper font-sans text-ink transition-colors dark:bg-ink dark:text-paper">
        <ThemeProvider>{children}</ThemeProvider>
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
STREAKLINE_EOF

mkdir -p "app"
cat > "app/page.tsx" << 'STREAKLINE_EOF'
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { SignInButton } from "@/components/SignInButton";
import { ThemeToggle } from "@/components/ThemeToggle";

export default async function Home() {
  const session = await getServerSession(authOptions);
  if (session) redirect("/dashboard");

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center px-4 py-16 sm:px-6 sm:py-24">
      <div className="flex items-center justify-between">
        <p className="font-mono text-xs uppercase tracking-tightest text-graphite">streakline</p>
        <ThemeToggle />
      </div>

      <h1 className="mt-4 text-4xl font-semibold leading-tight tracking-tightest sm:text-5xl">
        Your commit streak,
        <br />
        without the noise.
      </h1>

      <p className="mt-5 max-w-md text-graphite">
        Connect your GitHub account to see your streak, contribution graph, language breakdown,
        and more — with nothing stored unless you choose to share it.
      </p>

      <div className="mt-10">
        <SignInButton />
      </div>

      <dl className="mt-16 grid grid-cols-1 gap-6 border-t border-hairline pt-8 font-mono text-xs text-graphite dark:border-white/10 sm:grid-cols-3">
        <div>
          <dt className="text-ink dark:text-paper">read-only</dt>
          <dd className="mt-1">Requests only the read:user scope. No repo or write access.</dd>
        </div>
        <div>
          <dt className="text-ink dark:text-paper">nothing stored by default</dt>
          <dd className="mt-1">
            Your data is fetched on load and never saved — unless you opt into the public
            leaderboard, which is off by default.
          </dd>
        </div>
        <div>
          <dt className="text-ink dark:text-paper">token stays server-side</dt>
          <dd className="mt-1">Your GitHub token never reaches the browser.</dd>
        </div>
      </dl>

      <a
        href="/changelog"
        className="mt-8 font-mono text-xs text-graphite underline decoration-hairline underline-offset-4 hover:text-ink dark:hover:text-paper"
      >
        project changelog →
      </a>
    </main>
  );
}
STREAKLINE_EOF

mkdir -p "components"
cat > "components/Leaderboard.tsx" << 'STREAKLINE_EOF'
"use client";

import { useCallback, useEffect, useState } from "react";
import { usePolling } from "@/hooks/usePolling";
import { LiveIndicator } from "@/components/LiveIndicator";

type Entry = { login: string; streak: number; avatarUrl: string };

export function Leaderboard() {
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [optedIn, setOptedIn] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/leaderboard");
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Could not load the leaderboard.");
      setEntries(body.entries);
      setOptedIn(body.optedIn);
      setEnabled(body.enabled ?? true);
      setLastUpdated(Date.now());
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    }
  }, []);

  useEffect(() => {
    setOrigin(window.location.origin);
    load();
  }, [load]);

  // Public data, cheap to read (no GitHub API call behind it) — a 1-minute
  // live refresh keeps the list current without any manual reload.
  usePolling(load, 60_000, enabled);

  async function toggle() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/leaderboard", { method: optedIn ? "DELETE" : "POST" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Something went wrong.");
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function copyEmbed() {
    await navigator.clipboard.writeText(`![streakline leaderboard](${origin}/leaderboard-card)`);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  if (!enabled) {
    return (
      <p className="text-xs text-graphite">
        The leaderboard isn't turned on for this instance yet — the person running it hasn't set
        up storage for it.
      </p>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-graphite">
          Opt in to show your current streak, username, and avatar publicly on this list.
        </p>
        <button
          onClick={toggle}
          disabled={busy}
          className="shrink-0 whitespace-nowrap font-mono text-xs underline decoration-hairline underline-offset-4 hover:text-ink disabled:opacity-50 dark:hover:text-paper"
        >
          {optedIn ? "leave leaderboard" : "join leaderboard"}
        </button>
      </div>

      {error && <p className="mt-3 font-mono text-xs text-graphite">{error}</p>}

      {entries && entries.length > 0 && (
        <>
          <div className="mt-4">
            <LiveIndicator lastUpdated={lastUpdated} />
          </div>
          <ol className="mt-2 divide-y divide-hairline font-mono text-sm dark:divide-white/10">
            {entries.map((entry, i) => (
              <li key={entry.login} className="flex items-center gap-3 py-2">
                <span className="w-5 text-xs text-graphite">{i + 1}</span>
                {entry.avatarUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={entry.avatarUrl} alt="" width={20} height={20} className="rounded-full" />
                )}
                <span className="flex-1 truncate">@{entry.login}</span>
                <span className="text-graphite">{entry.streak}d</span>
              </li>
            ))}
          </ol>

          <div className="mt-4 flex items-center gap-3">
            <code className="flex-1 truncate border border-hairline bg-hairline/30 px-2 py-1 font-mono text-xs dark:border-white/10 dark:bg-white/5">
              ![streakline leaderboard]({origin}/leaderboard-card)
            </code>
            <button
              onClick={copyEmbed}
              className="shrink-0 font-mono text-xs text-graphite underline decoration-hairline underline-offset-4 hover:text-ink dark:hover:text-paper"
            >
              {copied ? "copied" : "copy"}
            </button>
          </div>
        </>
      )}

      {entries && entries.length === 0 && (
        <p className="mt-4 font-mono text-xs text-graphite">No one's opted in yet — be the first.</p>
      )}
    </div>
  );
}
STREAKLINE_EOF

mkdir -p "components"
cat > "components/ShareCard.tsx" << 'STREAKLINE_EOF'
"use client";

import { useEffect, useState } from "react";

const THEMES = ["light", "dark", "dracula"] as const;
type ThemeName = (typeof THEMES)[number];

type Prefs = { theme: ThemeName; accent: string; bg: string; useCustom: boolean };
const DEFAULT_PREFS: Prefs = { theme: "light", accent: "#216E39", bg: "#FAFAF7", useCustom: false };
const KEY = "streakline-card-prefs";

export function ShareCard({ login }: { login: string }) {
  const [copied, setCopied] = useState(false);
  const [status, setStatus] = useState<"checking" | "ready" | "not-configured" | "error">("checking");
  const [origin, setOrigin] = useState("");
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);

  useEffect(() => {
    setOrigin(window.location.origin);
    const stored = window.localStorage.getItem(KEY);
    if (stored) {
      try {
        setPrefs({ ...DEFAULT_PREFS, ...JSON.parse(stored) });
      } catch {
        /* ignore malformed local storage, fall back to defaults */
      }
    }
  }, []);

  function updatePrefs(next: Partial<Prefs>) {
    setPrefs((prev) => {
      const merged = { ...prev, ...next };
      window.localStorage.setItem(KEY, JSON.stringify(merged));
      return merged;
    });
  }

  const params = new URLSearchParams({ theme: prefs.theme });
  if (prefs.useCustom) {
    params.set("accent", prefs.accent.replace("#", ""));
    params.set("bg", prefs.bg.replace("#", ""));
  }
  const path = `/card/${login}?${params.toString()}`;
  const badgePath = `/badge/${login}`;

  useEffect(() => {
    setStatus("checking");
    fetch(path)
      .then((res) => {
        if (res.status === 501) setStatus("not-configured");
        else if (res.ok) setStatus("ready");
        else setStatus("error");
      })
      .catch(() => setStatus("error"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path]);

  async function copy(text: string) {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  if (status === "not-configured") {
    return (
      <p className="text-xs text-graphite">
        Sharing isn't turned on for this instance yet — the person running it hasn't set up a
        public data token for it.
      </p>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        {THEMES.map((t) => (
          <button
            key={t}
            onClick={() => updatePrefs({ theme: t, useCustom: false })}
            className={
              "border px-3 py-1 font-mono text-xs capitalize " +
              (prefs.theme === t && !prefs.useCustom
                ? "border-ink bg-ink text-paper dark:border-paper dark:bg-paper dark:text-ink"
                : "border-hairline text-graphite hover:text-ink dark:border-white/10 dark:hover:text-paper")
            }
          >
            {t}
          </button>
        ))}
        <button
          onClick={() => updatePrefs({ useCustom: true })}
          className={
            "border px-3 py-1 font-mono text-xs " +
            (prefs.useCustom
              ? "border-ink bg-ink text-paper dark:border-paper dark:bg-paper dark:text-ink"
              : "border-hairline text-graphite hover:text-ink dark:border-white/10 dark:hover:text-paper")
          }
        >
          custom
        </button>
      </div>

      {prefs.useCustom && (
        <div className="mt-3 flex items-center gap-4 font-mono text-xs text-graphite">
          <label className="flex items-center gap-2">
            accent
            <input
              type="color"
              value={prefs.accent}
              onChange={(e) => updatePrefs({ accent: e.target.value })}
              className="h-6 w-8 cursor-pointer border border-hairline bg-transparent dark:border-white/10"
            />
          </label>
          <label className="flex items-center gap-2">
            background
            <input
              type="color"
              value={prefs.bg}
              onChange={(e) => updatePrefs({ bg: e.target.value })}
              className="h-6 w-8 cursor-pointer border border-hairline bg-transparent dark:border-white/10"
            />
          </label>
        </div>
      )}

      <div className="mt-4">
        {status === "checking" && <p className="text-xs text-graphite">checking…</p>}
        {status === "error" && <p className="text-xs text-graphite">Couldn't generate a card right now.</p>}
        {status === "ready" && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={path}
            alt={`${login}'s streak card`}
            width={600}
            height={200}
            className="w-full max-w-md rounded border border-hairline dark:border-white/10"
          />
        )}
      </div>

      <div className="mt-3 flex items-center gap-3">
        <code className="flex-1 truncate border border-hairline bg-hairline/30 px-2 py-1 font-mono text-xs dark:border-white/10 dark:bg-white/5">
          ![streakline]({origin}
          {path})
        </code>
        <button
          onClick={() => copy(`![streakline](${origin}${path})`)}
          className="shrink-0 font-mono text-xs text-graphite underline decoration-hairline underline-offset-4 hover:text-ink dark:hover:text-paper"
        >
          {copied ? "copied" : "copy"}
        </button>
      </div>

      <div className="mt-3 flex items-center gap-3">
        <code className="flex-1 truncate border border-hairline bg-hairline/30 px-2 py-1 font-mono text-xs dark:border-white/10 dark:bg-white/5">
          ![streak]({origin}
          {badgePath})
        </code>
        <button
          onClick={() => copy(`![streak](${origin}${badgePath})`)}
          className="shrink-0 font-mono text-xs text-graphite underline decoration-hairline underline-offset-4 hover:text-ink dark:hover:text-paper"
        >
          {copied ? "copied" : "copy badge"}
        </button>
      </div>

      <p className="mt-2 text-xs text-graphite">
        Public and read-only — anyone with this link can view this card, same as your GitHub profile.
      </p>
    </div>
  );
}
STREAKLINE_EOF

mkdir -p "components"
cat > "components/TopRepos.tsx" << 'STREAKLINE_EOF'
import type { RepoBreakdown } from "@/lib/github";

export function TopRepos({ data }: { data: RepoBreakdown }) {
  if (data.repos.length === 0) return null;
  const top = data.repos.slice(0, 8);
  const max = Math.max(1, ...top.map((r) => r.contributions));

  return (
    <div className="space-y-2 font-mono text-xs">
      {top.map((repo) => {
        const intensity = repo.contributions / max;
        return (
          <div key={repo.name} className="flex items-center gap-3">
            <a
              href={repo.url}
              target="_blank"
              rel="noreferrer noopener"
              className="w-32 shrink-0 truncate text-ink hover:underline dark:text-paper"
            >
              {repo.name}
            </a>
            <div className="flex h-2 flex-1 gap-0.5">
              {Array.from({ length: 12 }).map((_, i) => (
                <div
                  key={i}
                  className="h-2 flex-1 rounded-sm bg-hairline dark:bg-white/10"
                  style={
                    i < Math.round(intensity * 12)
                      ? { background: repo.color ?? "#30A14E" }
                      : undefined
                  }
                />
              ))}
            </div>
            <span className="w-20 shrink-0 text-right text-graphite">{repo.contributions} commits</span>
          </div>
        );
      })}
    </div>
  );
}
STREAKLINE_EOF

mkdir -p "app/api/cron/streak-risk"
cat > "app/api/cron/streak-risk/route.ts" << 'STREAKLINE_EOF'
import { NextResponse } from "next/server";
import { listSubscriptions } from "@/lib/notifications";
import { fetchPublicUserContributions, GitHubApiError } from "@/lib/github";
import { computeStreaks } from "@/lib/streak";
import { sendEmail, isEmailConfigured } from "@/lib/email";

export const maxDuration = 60;

function buildMessage(login: string, currentStreak: number, unsubToken: string, origin: string) {
  const unsubUrl = `${origin}/api/notify/unsubscribe?token=${unsubToken}`;
  return [
    `Hey @${login} — you're on a ${currentStreak}-day GitHub streak, and there's no contribution logged yet today.`,
    ``,
    `A single commit, PR, or review keeps it alive.`,
    ``,
    `— streakline`,
    ``,
    `Unsubscribe: ${unsubUrl}`
  ].join("\n");
}

/**
 * Invoked by Vercel Cron (see vercel.json), once daily. Protected by
 * CRON_SECRET — Vercel automatically sends it as a Bearer token when that
 * env var is set, so this rejects any other caller, including someone who
 * discovers the URL.
 *
 * Deliberately checks PUBLIC contribution data (the same server token the
 * share card uses) rather than needing anyone's personal GitHub token —
 * this app never stores those, and this is why it doesn't have to.
 */
export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isEmailConfigured()) {
    return NextResponse.json({ skipped: "Email not configured." });
  }

  const origin = new URL(req.url).origin;
  const subs = await listSubscriptions();

  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const sub of subs) {
    try {
      const data = await fetchPublicUserContributions(sub.login);
      const { current } = computeStreaks(data.days);
      const today = new Date().toISOString().slice(0, 10);
      const todayCount = data.days.find((d) => d.date === today)?.count ?? 0;

      // Only email if there's an actual streak worth protecting AND today
      // genuinely has nothing logged yet — never just "here's your streak".
      if (current > 0 && todayCount === 0) {
        await sendEmail(sub.email, `Your ${current}-day streak is at risk`, buildMessage(sub.login, current, sub.unsubToken, origin));
        sent += 1;
      } else {
        skipped += 1;
      }
    } catch (err) {
      failed += 1;
      const status = err instanceof GitHubApiError ? err.status : "unknown";
      console.error(`streak-risk check failed for ${sub.login}`, status, err);
    }
  }

  return NextResponse.json({ checked: subs.length, sent, skipped, failed });
}
STREAKLINE_EOF

mkdir -p "app/api/notify"
cat > "app/api/notify/route.ts" << 'STREAKLINE_EOF'
import { NextResponse } from "next/server";
import { getAuthedUser } from "@/lib/session";
import { checkRateLimit } from "@/lib/rateLimit";
import { subscribe, unsubscribe, getSubscription, isNotifyConfigured } from "@/lib/notifications";
import { isEmailConfigured } from "@/lib/email";

const NOT_CONFIGURED = "Email notifications aren't set up on this server yet. See README.";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function enabled() {
  return isNotifyConfigured() && isEmailConfigured();
}

export async function GET(req: Request) {
  const user = await getAuthedUser(req);
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  if (!enabled()) return NextResponse.json({ subscribed: false, enabled: false });

  const sub = await getSubscription(user.login);
  return NextResponse.json({ subscribed: Boolean(sub), enabled: true });
}

export async function POST(req: Request) {
  if (!enabled()) return NextResponse.json({ error: NOT_CONFIGURED }, { status: 501 });

  const user = await getAuthedUser(req);
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const { success, reset } = await checkRateLimit(user.login);
  if (!success) {
    return NextResponse.json(
      { error: "Too many requests. Try again shortly." },
      { status: 429, headers: { "Retry-After": Math.max(0, Math.ceil((reset - Date.now()) / 1000)).toString() } }
    );
  }

  const body = await req.json().catch(() => ({}));
  const email = typeof body.email === "string" ? body.email.trim() : "";
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  try {
    await subscribe(user.login, email);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("notify subscribe failed", err);
    return NextResponse.json({ error: "Could not save that right now." }, { status: 502 });
  }
}

export async function DELETE(req: Request) {
  const user = await getAuthedUser(req);
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  await unsubscribe(user.login);
  return NextResponse.json({ ok: true });
}
STREAKLINE_EOF

mkdir -p "app/api/notify/unsubscribe"
cat > "app/api/notify/unsubscribe/route.ts" << 'STREAKLINE_EOF'
import { unsubscribeByToken } from "@/lib/notifications";
import { checkRateLimit, identifierFromRequest } from "@/lib/rateLimit";

export async function GET(req: Request) {
  const { success } = await checkRateLimit(identifierFromRequest(req), "strict");
  if (!success) return new Response("Too many requests", { status: 429 });

  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token") ?? "";
  if (!token) return new Response("Missing token", { status: 400 });

  const ok = await unsubscribeByToken(token);

  return new Response(
    ok
      ? "You've been unsubscribed from streak-risk reminders. You can close this tab."
      : "That unsubscribe link is invalid or already used.",
    { status: ok ? 200 : 404, headers: { "Content-Type": "text/plain" } }
  );
}
STREAKLINE_EOF

mkdir -p "app/api/project-prs"
cat > "app/api/project-prs/route.ts" << 'STREAKLINE_EOF'
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
STREAKLINE_EOF

mkdir -p "app/badge/[username]"
cat > "app/badge/[username]/route.ts" << 'STREAKLINE_EOF'
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
STREAKLINE_EOF

mkdir -p "app/badge/project"
cat > "app/badge/project/route.ts" << 'STREAKLINE_EOF'
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
STREAKLINE_EOF

mkdir -p "app/changelog"
cat > "app/changelog/page.tsx" << 'STREAKLINE_EOF'
import { Changelog } from "@/components/Changelog";

export const metadata = {
  title: "streakline — changelog"
};

export default function ChangelogPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-10 sm:px-6 sm:py-16">
      <a href="/" className="font-mono text-xs text-graphite underline decoration-hairline underline-offset-4 hover:text-ink dark:hover:text-paper">
        ← streakline
      </a>
      <h1 className="mt-4 text-2xl font-semibold tracking-tightest">changelog</h1>
      <p className="mt-2 font-mono text-xs text-graphite">
        Pull request history for this project, live.
      </p>
      <Changelog />
    </main>
  );
}
STREAKLINE_EOF

mkdir -p "app/leaderboard-card"
cat > "app/leaderboard-card/route.tsx" << 'STREAKLINE_EOF'
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
STREAKLINE_EOF

mkdir -p "components"
cat > "components/Changelog.tsx" << 'STREAKLINE_EOF'
"use client";

import { useCallback, useEffect, useState } from "react";
import { usePolling } from "@/hooks/usePolling";
import { LiveIndicator } from "@/components/LiveIndicator";
import type { ProjectPR, ProjectPRCounts } from "@/lib/projectPRs";

type State =
  | { status: "loading" }
  | { status: "disabled" }
  | { status: "error"; message: string }
  | { status: "ready"; prs: ProjectPR[]; counts: ProjectPRCounts };

const STATE_STYLE: Record<ProjectPR["state"], string> = {
  merged: "border-ink bg-ink text-paper dark:border-paper dark:bg-paper dark:text-ink",
  open: "border-grid-3 text-grid-3",
  closed: "border-hairline text-graphite dark:border-white/10"
};

export function Changelog() {
  const [state, setState] = useState<State>({ status: "loading" });
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/project-prs");
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Could not load PR history.");
      if (!body.enabled) {
        setState({ status: "disabled" });
        return;
      }
      setState({ status: "ready", prs: body.prs, counts: body.counts });
      setLastUpdated(Date.now());
    } catch (err) {
      setState((prev) => (prev.status === "ready" ? prev : { status: "error", message: (err as Error).message }));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  usePolling(load, 120_000, state.status !== "disabled");

  if (state.status === "loading") {
    return <p className="mt-10 font-mono text-sm text-graphite">loading…</p>;
  }

  if (state.status === "disabled") {
    return (
      <p className="mt-10 font-mono text-sm text-graphite">
        Project PR history isn't configured for this instance — the person running it hasn't set
        a GITHUB_PROJECT_REPO.
      </p>
    );
  }

  if (state.status === "error") {
    return <p className="mt-10 font-mono text-sm text-graphite">{state.message}</p>;
  }

  const { prs, counts } = state;

  return (
    <div className="mt-10">
      <div className="flex flex-wrap items-center gap-6 font-mono text-sm">
        <span>{counts.open} open</span>
        <span>{counts.merged} merged</span>
        <span>{counts.closed} closed</span>
        <LiveIndicator lastUpdated={lastUpdated} />
      </div>

      <ul className="mt-6 divide-y divide-hairline border-t border-hairline font-mono text-sm dark:divide-white/10 dark:border-white/10">
        {prs.map((pr) => (
          <li key={pr.number} className="flex items-center gap-3 py-3">
            <span className={"shrink-0 border px-2 py-0.5 text-xs " + STATE_STYLE[pr.state]}>{pr.state}</span>
            <a href={pr.url} target="_blank" rel="noreferrer noopener" className="flex-1 truncate hover:underline">
              #{pr.number} {pr.title}
            </a>
            <span className="shrink-0 text-xs text-graphite">@{pr.author}</span>
          </li>
        ))}
      </ul>

      {prs.length === 0 && <p className="mt-6 font-mono text-xs text-graphite">No pull requests yet.</p>}
    </div>
  );
}
STREAKLINE_EOF

mkdir -p "components"
cat > "components/LiveIndicator.tsx" << 'STREAKLINE_EOF'
"use client";

import { useEffect, useState } from "react";

function relativeTime(ms: number): string {
  const seconds = Math.max(0, Math.round((Date.now() - ms) / 1000));
  if (seconds < 5) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  return `${minutes}m ago`;
}

export function LiveIndicator({ lastUpdated }: { lastUpdated: number | null }) {
  const [, forceTick] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => forceTick((t) => t + 1), 5000);
    return () => clearInterval(interval);
  }, []);

  if (!lastUpdated) return null;

  return (
    <span className="inline-flex items-center gap-1.5 font-mono text-xs text-graphite">
      <span className="h-1.5 w-1.5 rounded-full bg-grid-3" />
      updated {relativeTime(lastUpdated)}
    </span>
  );
}
STREAKLINE_EOF

mkdir -p "components"
cat > "components/Milestones.tsx" << 'STREAKLINE_EOF'
import type { MilestoneStatus } from "@/lib/milestones";

export function Milestones({ milestones, upNext }: { milestones: MilestoneStatus[]; upNext: string | null }) {
  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {milestones.map((m) => (
          <span
            key={m.days}
            className={
              "border px-3 py-1.5 font-mono text-xs " +
              (m.reached
                ? "border-ink bg-ink text-paper dark:border-paper dark:bg-paper dark:text-ink"
                : "border-hairline text-graphite dark:border-white/10")
            }
          >
            {m.label}
          </span>
        ))}
      </div>
      {upNext && <p className="mt-3 text-xs text-graphite">{upNext}</p>}
    </div>
  );
}
STREAKLINE_EOF

mkdir -p "components"
cat > "components/MonthlyInsights.tsx" << 'STREAKLINE_EOF'
import type { MonthlySummary } from "@/lib/insights";

export function MonthlyInsights({ months }: { months: MonthlySummary[] }) {
  const recent = months.slice(-6);
  if (recent.length === 0) return null;
  const max = Math.max(1, ...recent.map((m) => m.total));

  return (
    <div className="space-y-2 font-mono text-xs">
      {recent.map((m) => (
        <div key={m.month} className="flex items-center gap-3">
          <span className="w-16 shrink-0 text-graphite">{m.label}</span>
          <div className="h-2 flex-1 rounded-full bg-hairline dark:bg-white/10">
            <div
              className="h-2 rounded-full bg-grid-3"
              style={{ width: `${Math.max(4, (m.total / max) * 100)}%` }}
            />
          </div>
          <span className="w-24 shrink-0 text-right text-graphite">
            {m.total} · {m.activeDays}d active
          </span>
        </div>
      ))}
    </div>
  );
}
STREAKLINE_EOF

mkdir -p "components"
cat > "components/NotifyCheckbox.tsx" << 'STREAKLINE_EOF'
"use client";

import { useEffect, useState } from "react";

export function NotifyCheckbox() {
  const [enabled, setEnabled] = useState(true);
  const [subscribed, setSubscribed] = useState(false);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [showInput, setShowInput] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/notify")
      .then((res) => res.json())
      .then((body) => {
        setEnabled(body.enabled ?? true);
        setSubscribed(body.subscribed ?? false);
      })
      .catch(() => setEnabled(false));
  }, []);

  async function toggle(checked: boolean) {
    setError(null);
    if (!checked) {
      setBusy(true);
      try {
        await fetch("/api/notify", { method: "DELETE" });
        setSubscribed(false);
      } finally {
        setBusy(false);
      }
      return;
    }
    setShowInput(true);
  }

  async function confirmSubscribe(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email })
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Something went wrong.");
      setSubscribed(true);
      setShowInput(false);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!enabled) return null;

  return (
    <div className="text-xs text-graphite">
      <label className="flex cursor-pointer items-center gap-2">
        <input
          type="checkbox"
          checked={subscribed}
          disabled={busy}
          onChange={(e) => toggle(e.target.checked)}
          className="h-3 w-3 accent-graphite"
        />
        email me if my streak is at risk
      </label>

      {showInput && !subscribed && (
        <form onSubmit={confirmSubscribe} className="mt-2 flex items-center gap-2">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="border border-hairline bg-transparent px-2 py-1 font-mono text-xs outline-none focus:border-ink dark:border-white/10 dark:focus:border-paper"
          />
          <button type="submit" disabled={busy} className="underline decoration-hairline underline-offset-4 hover:text-ink dark:hover:text-paper">
            confirm
          </button>
        </form>
      )}

      {error && <p className="mt-1">{error}</p>}
    </div>
  );
}
STREAKLINE_EOF

mkdir -p "components"
cat > "components/ServiceWorkerRegister.tsx" << 'STREAKLINE_EOF'
"use client";

import { useEffect } from "react";

export function ServiceWorkerRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Non-critical — the app works fine without it, just without
        // installability/offline fallback.
      });
    }
  }, []);

  return null;
}
STREAKLINE_EOF

mkdir -p "components"
cat > "components/WeeklyTrend.tsx" << 'STREAKLINE_EOF'
import { weeklyTrend, type WeeklySummary } from "@/lib/insights";

export function WeeklyTrend({ weekly }: { weekly: WeeklySummary[] }) {
  const trend = weeklyTrend(weekly);
  if (!trend) return null;

  const diff = trend.thisWeek - trend.recentAverage;
  const pct = trend.recentAverage > 0 ? Math.round((diff / trend.recentAverage) * 100) : null;
  const direction = diff > 0 ? "up" : diff < 0 ? "down" : "flat";

  return (
    <p className="font-mono text-xs text-graphite">
      This week: {trend.thisWeek} contributions — {direction}
      {pct !== null && direction !== "flat" ? ` ${Math.abs(pct)}%` : ""} vs. your last 4-week average (
      {trend.recentAverage.toFixed(1)}).
    </p>
  );
}
STREAKLINE_EOF

mkdir -p "hooks"
cat > "hooks/usePolling.ts" << 'STREAKLINE_EOF'
"use client";

import { useEffect, useRef } from "react";

/**
 * Calls `callback` on an interval for a live-updating dashboard, without
 * needing a manual page refresh. Pauses while the tab is in the background
 * (visibilitychange) — no point spending API calls / rate-limit budget on
 * a tab nobody's looking at — and does one immediate refresh when the tab
 * becomes visible again, so switching back always shows current data.
 */
export function usePolling(callback: () => void, intervalMs: number, enabled = true) {
  const savedCallback = useRef(callback);
  savedCallback.current = callback;

  useEffect(() => {
    if (!enabled) return;

    const interval = setInterval(() => {
      if (document.visibilityState === "visible") savedCallback.current();
    }, intervalMs);

    function onVisibilityChange() {
      if (document.visibilityState === "visible") savedCallback.current();
    }
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intervalMs, enabled]);
}
STREAKLINE_EOF

mkdir -p "lib"
cat > "lib/badgeSvg.ts" << 'STREAKLINE_EOF'
/** A small shields.io-style badge: a gray label block and a colored value block, sized to fit the text. */
export function badgeSvg(label: string, value: string, color: string): string {
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
STREAKLINE_EOF

mkdir -p "lib"
cat > "lib/cardTheme.ts" << 'STREAKLINE_EOF'
export type CardTheme = {
  bg: string;
  ink: string;
  muted: string;
  accent: string; // used to derive the 4-step intensity scale
};

export const THEME_PRESETS: Record<string, CardTheme> = {
  light: { bg: "#FAFAF7", ink: "#14171A", muted: "#6B7280", accent: "#216E39" },
  dark: { bg: "#14171A", ink: "#FAFAF7", muted: "#9CA3AF", accent: "#39D353" },
  dracula: { bg: "#282A36", ink: "#F8F8F2", muted: "#6272A4", accent: "#BD93F9" }
};

const HEX_RE = /^#?[0-9a-fA-F]{6}$/;

function normalizeHex(hex: string): string | null {
  if (!HEX_RE.test(hex)) return null;
  return hex.startsWith("#") ? hex : `#${hex}`;
}

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function mix(a: [number, number, number], b: [number, number, number], t: number): string {
  const r = Math.round(a[0] + (b[0] - a[0]) * t);
  const g = Math.round(a[1] + (b[1] - a[1]) * t);
  const bl = Math.round(a[2] + (b[2] - a[2]) * t);
  return `rgb(${r}, ${g}, ${bl})`;
}

/** Resolves the theme for a card request: a named preset, optionally overridden by validated custom hex colors. */
export function resolveTheme(searchParams: URLSearchParams): CardTheme {
  const presetName = searchParams.get("theme");
  const preset = (presetName && THEME_PRESETS[presetName]) || THEME_PRESETS.light!;

  const bgOverride = searchParams.get("bg");
  const accentOverride = searchParams.get("accent");

  const bg = (bgOverride && normalizeHex(bgOverride)) || preset.bg;
  const accent = (accentOverride && normalizeHex(accentOverride)) || preset.accent;

  // ink/muted stay tied to the preset (not user-overridable) — this is what
  // keeps a custom accent from producing an unreadable card, e.g. a bright
  // yellow accent on a white background with no forced contrast anywhere.
  return { bg, ink: preset.ink, muted: preset.muted, accent };
}

/** A 5-step intensity scale (0 = no contributions) blended from the theme's background toward its accent. */
export function levelColors(theme: CardTheme): string[] {
  const bgRgb = hexToRgb(theme.bg);
  const accentRgb = hexToRgb(theme.accent);
  return [
    mix(bgRgb, accentRgb, 0.12), // empty cell — a faint hint of the accent, not fully invisible
    mix(bgRgb, accentRgb, 0.35),
    mix(bgRgb, accentRgb, 0.58),
    mix(bgRgb, accentRgb, 0.8),
    mix(bgRgb, accentRgb, 1)
  ];
}
STREAKLINE_EOF

mkdir -p "lib"
cat > "lib/email.ts" << 'STREAKLINE_EOF'
const FROM = process.env.NOTIFY_FROM_EMAIL || "streakline <onboarding@resend.dev>";

export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

export async function sendEmail(to: string, subject: string, text: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("Email is not configured on this server.");

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ from: FROM, to, subject, text })
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Resend API error (${res.status}): ${body}`);
  }
}
STREAKLINE_EOF

mkdir -p "lib"
cat > "lib/heatLevel.ts" << 'STREAKLINE_EOF'
/** Maps a day's contribution count to a 0–4 intensity level, relative to the max in the current dataset. */
export function levelFor(count: number, max: number): number {
  if (count === 0) return 0;
  if (max <= 0) return 1;
  const ratio = count / max;
  if (ratio > 0.75) return 4;
  if (ratio > 0.5) return 3;
  if (ratio > 0.25) return 2;
  return 1;
}
STREAKLINE_EOF

mkdir -p "lib"
cat > "lib/insights.ts" << 'STREAKLINE_EOF'
import type { ContributionDay } from "./github";

export type MonthlySummary = {
  month: string; // "2026-08"
  label: string; // "Aug 2026"
  total: number;
  activeDays: number;
};

export function computeMonthlySummaries(days: ContributionDay[]): MonthlySummary[] {
  const byMonth = new Map<string, { total: number; activeDays: number }>();

  for (const day of days) {
    const key = day.date.slice(0, 7); // "YYYY-MM"
    const existing = byMonth.get(key) ?? { total: 0, activeDays: 0 };
    existing.total += day.count;
    if (day.count > 0) existing.activeDays += 1;
    byMonth.set(key, existing);
  }

  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  return [...byMonth.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, v]) => {
      const [year, m] = month.split("-");
      return { month, label: `${MONTHS[Number(m) - 1]} ${year}`, ...v };
    });
}

export type WeeklySummary = {
  weekEnding: string;
  total: number;
  activeDays: number;
};

export function computeWeeklySummaries(weeks: ContributionDay[][]): WeeklySummary[] {
  return weeks.map((week) => {
    const total = week.reduce((sum, d) => sum + d.count, 0);
    const activeDays = week.filter((d) => d.count > 0).length;
    const last = week[week.length - 1];
    return { weekEnding: last?.date ?? "", total, activeDays };
  });
}

/** This week vs. the average of the prior 4 weeks — a simple, honest "trending up/down" signal. */
export function weeklyTrend(weekly: WeeklySummary[]): { thisWeek: number; recentAverage: number } | null {
  if (weekly.length < 2) return null;
  const thisWeek = weekly[weekly.length - 1]?.total ?? 0;
  const priorFour = weekly.slice(-5, -1);
  if (priorFour.length === 0) return null;
  const recentAverage = priorFour.reduce((sum, w) => sum + w.total, 0) / priorFour.length;
  return { thisWeek, recentAverage };
}
STREAKLINE_EOF

mkdir -p "lib"
cat > "lib/milestones.ts" << 'STREAKLINE_EOF'
export type Milestone = {
  days: number;
  label: string;
};

export const MILESTONES: Milestone[] = [
  { days: 7, label: "1 week" },
  { days: 30, label: "1 month" },
  { days: 100, label: "100 days" },
  { days: 180, label: "6 months" },
  { days: 365, label: "1 year" }
];

export type MilestoneStatus = Milestone & {
  reached: boolean; // by longest streak ever, so it stays earned even if the current streak resets
  active: boolean; // currently in progress (current streak has reached it right now)
};

export function computeMilestoneStatus(current: number, longest: number): MilestoneStatus[] {
  return MILESTONES.map((m) => ({
    ...m,
    reached: longest >= m.days,
    active: current >= m.days
  }));
}

/** The next milestone not yet reached by the current streak, and how many days remain — for a "3 days to your next badge" style prompt. */
export function nextMilestone(current: number): { milestone: Milestone; daysRemaining: number } | null {
  const next = MILESTONES.find((m) => m.days > current);
  if (!next) return null;
  return { milestone: next, daysRemaining: next.days - current };
}
STREAKLINE_EOF

mkdir -p "lib"
cat > "lib/notifications.ts" << 'STREAKLINE_EOF'
import { getRedis, isRedisConfigured } from "./redis";

const SUBS_KEY = "streakline:notify:subs"; // login -> JSON { email, unsubToken, subscribedAt }
const TOKEN_KEY = "streakline:notify:tokens"; // unsubToken -> login

export { isRedisConfigured as isNotifyConfigured };

export type Subscription = { login: string; email: string; unsubToken: string; subscribedAt: number };

export async function subscribe(login: string, email: string): Promise<void> {
  const redis = getRedis();
  if (!redis) throw new Error("Notifications are not configured on this server.");

  const unsubToken = crypto.randomUUID();
  const record: Subscription = { login, email, unsubToken, subscribedAt: Date.now() };

  await Promise.all([
    redis.hset(SUBS_KEY, { [login]: JSON.stringify(record) }),
    redis.hset(TOKEN_KEY, { [unsubToken]: login })
  ]);
}

export async function unsubscribe(login: string): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  const existing = await getSubscription(login);
  await redis.hdel(SUBS_KEY, login);
  if (existing) await redis.hdel(TOKEN_KEY, existing.unsubToken);
}

export async function unsubscribeByToken(token: string): Promise<boolean> {
  const redis = getRedis();
  if (!redis) return false;
  const login = await redis.hget<string>(TOKEN_KEY, token);
  if (!login) return false;
  await Promise.all([redis.hdel(SUBS_KEY, login), redis.hdel(TOKEN_KEY, token)]);
  return true;
}

export async function getSubscription(login: string): Promise<Subscription | null> {
  const redis = getRedis();
  if (!redis) return null;
  const raw = await redis.hget<string>(SUBS_KEY, login);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Subscription;
  } catch {
    return null;
  }
}

export async function listSubscriptions(): Promise<Subscription[]> {
  const redis = getRedis();
  if (!redis) return [];
  const all = await redis.hgetall<Record<string, string>>(SUBS_KEY);
  if (!all) return [];
  return Object.values(all)
    .map((raw) => {
      try {
        return JSON.parse(raw) as Subscription;
      } catch {
        return null;
      }
    })
    .filter((s): s is Subscription => s !== null);
}
STREAKLINE_EOF

mkdir -p "lib"
cat > "lib/projectPRs.ts" << 'STREAKLINE_EOF'
export type ProjectPR = {
  number: number;
  title: string;
  author: string;
  state: "open" | "merged" | "closed";
  url: string;
  updatedAt: string;
};

export type ProjectPRCounts = {
  open: number;
  merged: number;
  closed: number;
};

function classify(pr: { state: string; merged_at: string | null }): ProjectPR["state"] {
  if (pr.merged_at) return "merged";
  return pr.state === "open" ? "open" : "closed";
}

async function githubRest(path: string) {
  const token = process.env.GITHUB_PUBLIC_DATA_TOKEN;
  if (!token) throw new Error("GITHUB_PUBLIC_DATA_TOKEN is not configured.");

  const res = await fetch(`https://api.github.com${path}`, {
    headers: {
      Authorization: `bearer ${token}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "streakline-app"
    },
    cache: "no-store"
  });

  if (!res.ok) throw new Error(`GitHub API error: ${res.status}`);
  return res.json();
}

export async function fetchProjectPullRequests(
  owner: string,
  repo: string,
  limit = 20
): Promise<ProjectPR[]> {
  const raw = await githubRest(
    `/repos/${owner}/${repo}/pulls?state=all&sort=updated&direction=desc&per_page=${limit}`
  );

  return (raw as Array<Record<string, unknown>>).map((pr) => ({
    number: pr.number as number,
    title: pr.title as string,
    author: (pr.user as { login?: string } | null)?.login ?? "unknown",
    state: classify(pr as { state: string; merged_at: string | null }),
    url: pr.html_url as string,
    updatedAt: pr.updated_at as string
  }));
}

/** Uses the search API for accurate total counts rather than paginating the list endpoint. */
export async function fetchProjectPRCounts(owner: string, repo: string): Promise<ProjectPRCounts> {
  const [open, merged, closed] = await Promise.all([
    githubRest(`/search/issues?q=repo:${owner}/${repo}+is:pr+is:open`),
    githubRest(`/search/issues?q=repo:${owner}/${repo}+is:pr+is:merged`),
    githubRest(`/search/issues?q=repo:${owner}/${repo}+is:pr+is:closed+is:unmerged`)
  ]);

  return {
    open: (open as { total_count: number }).total_count,
    merged: (merged as { total_count: number }).total_count,
    closed: (closed as { total_count: number }).total_count
  };
}
STREAKLINE_EOF

mkdir -p "lib"
cat > "lib/projectRepo.ts" << 'STREAKLINE_EOF'
/** Parses "owner/repo" from GITHUB_PROJECT_REPO. Returns null if unset or malformed, so callers can hide the feature cleanly. */
export function getProjectRepo(): { owner: string; repo: string } | null {
  const raw = process.env.GITHUB_PROJECT_REPO;
  if (!raw) return null;
  const [owner, repo] = raw.split("/");
  if (!owner || !repo) return null;
  return { owner, repo };
}
STREAKLINE_EOF

mkdir -p "public"
cat > "public/manifest.json" << 'STREAKLINE_EOF'
{
  "name": "streakline",
  "short_name": "streakline",
  "description": "Your GitHub streak, plainly.",
  "start_url": "/dashboard",
  "display": "standalone",
  "background_color": "#FAFAF7",
  "theme_color": "#14171A",
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any maskable" }
  ]
}
STREAKLINE_EOF

mkdir -p "public"
cat > "public/offline.html" << 'STREAKLINE_EOF'
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>streakline — offline</title>
    <style>
      body {
        background: #fafaf7;
        color: #14171a;
        font-family: ui-monospace, SFMono-Regular, monospace;
        display: flex;
        min-height: 100vh;
        align-items: center;
        justify-content: center;
        margin: 0;
      }
      @media (prefers-color-scheme: dark) {
        body {
          background: #14171a;
          color: #fafaf7;
        }
      }
      p {
        font-size: 14px;
        color: #6b7280;
      }
    </style>
  </head>
  <body>
    <p>You're offline — streakline needs a connection to load your streak.</p>
  </body>
</html>
STREAKLINE_EOF

mkdir -p "public"
cat > "public/sw.js" << 'STREAKLINE_EOF'
// Deliberately minimal: this only exists for two things — installability
// (PWA requires a service worker to exist at all) and a friendly offline
// screen instead of the browser's default error page. It does NOT cache
// or intercept API responses, auth routes, or the dashboard's live data —
// streak data must always be fresh, and messing with /api/auth/* via a
// service worker is a good way to break OAuth in confusing ways.

const CACHE = "streakline-shell-v1";
const SHELL_ASSETS = ["/manifest.json", "/icon-192.png", "/icon-512.png", "/offline.html"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL_ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  if (new URL(req.url).origin !== self.location.origin) return;
  // Only handle top-level page navigations (offline fallback). Everything
  // else — API calls, RSC data, auth — passes straight through untouched.
  if (req.mode !== "navigate") return;

  event.respondWith(fetch(req).catch(() => caches.match("/offline.html")));
});
STREAKLINE_EOF

mkdir -p "public"
echo "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ufKF5+eCm9zx7bfHZic/4Ae3HXKfifbw8Egam5g0NhHfqqqqGq9HCLEr5zMrBmT7ZHoKe6i2fbrTKvucO1fS8Y6KnWBAQgih1+uzt2yz1m5vrV7b1tZmrd1sHAMSbW1tS5evMBqht1HvdvLU6YwNf7HWbjaOAYmVq9IP5RVYd8/3MzZu/eRT6+5pm+w6IKPR+NLitI83b7X6zu3t7a+9/sbrf/gTeH2I7ZMjoDXvrFu4aPHefV9a8SvlDxz8euy4SZ/v/cJaG94ve+u2JxOSMrOym69efXhH6VlynAe6Q6VyiB05IjZ2ZHRUZGTkMDeN5ufuoL98OTf3wLbtO0vLyh/GhA/k6OgYNyp2VOyI0NAhgYH9+3p7u7i4ODk5Wbyj7Z8HkiyguymVyo6vPQwOCgoODgwKCvR67DGNRqN2Vatd1EqlorW19dq1lsamRp2urrKquqSk9MS/TpWWllm8MIg6T+KAyBbI8RqIbBYDIggDIggDIggDIggDIggDIggDIggDIggDIggDIggDIggDIggDIggDIggDIggDIggDIggDIggDIggDIggDIggDIggDIggDIggDIggDIggDIggDIggDIggDIggDIggDIggDIggDIggDIggDIggDIggDIggDIggDIggDIggDIggDIggDIggDIggDIggDIggDIggDIggDIggDIggDIggDIggDIggDIggDIggDIggDIggDIggDIggDIggDIggDIsh/AIJzQXgR6xLiAAAAAElFTkSuQmCC" | base64 -d > public/icon-192.png
echo "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AKEIAAAIRQAAQCgCAABCEQAAEIoAAIBQBAAAhCIAACAUAQAAoQgAAAhFAABAKAIAAEIRAAAQigAAgFAEAACEIgAAIBQBAAChCAAACEUAAEAoAgAAQhEAABCKAACAUAQAAIQiAAAgFAEAAKEIAAAIRQAAQCgCAABCEQAAEIoAAIBQBAAAhCIAACAUAQAAoQgAAAhFAABAKAIAAEIRAAAQigAAgFAEAACEIgAAIBQBAAChCAAACEUAAEAoAgAAQhEAABCKAACAUAQAAIQiAAAgFAEAAKEIAAAIRQAAQCgCAABCEQAAEIoAAIBQBAAAhCIAACAUAQAAoQgAAAhFAABAKAIAAEIRAAAQigAAgFAEAACEIgAAIBQBAAChCAAACEUAAEAoAgAAQhEAABCKAACAUAQAAIQiAAAgFAEAAKEIAAAIRQAAQCgCAABCEQAAEIoAAIBQBAAAhCIAACAUAQAAoQgAAAhFAABAKAIAAEIRAAAQigAAgFAEAACEIgAAIBQBAAChCAAACEUAAEAoAgAAQhEAABCKAACAUAQAAIQiAAAgFAEAAKEIAAAIRQAAQCgCAABCEQAAEIoAAIBQBAAAhCIAACAUAQAAoQgAAAhFAABAKAIAAEIRAAAQigAAgFAEAACEIgAAIBQBAAChCAAACEUAAEAoAgAAQhEAABCKAACAUAQAAIQiAAAgFAEAAKEIAAAIRQAAQCgCAABCEQAAEIoAAIBQBAAAhCIAACAUAQAAof4XlNVhuK93cewAAAAASUVORK5CYII=" | base64 -d > public/icon-512.png

echo "Done. 40 files written."
echo "Now run: git add -A && git status  (check the list) then commit + push."