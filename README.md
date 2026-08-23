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
