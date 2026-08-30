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
