/** @type {import('next').NextConfig} */

// Content-Security-Policy lives in middleware.ts, NOT here. Reason: Next.js
// injects its own inline hydration scripts on every page, and their content
// (and therefore hash) is different on every build/request — a static
// SHA-256 allowlist in this file can only ever cover a script that never
// changes, like our own theme-init script, not Next's own. The only correct
// fix is a nonce generated fresh per request, which requires middleware.
const securityHeaders = [
  // Prevent the site from being framed (clickjacking protection).
  { key: "X-Frame-Options", value: "DENY" },
  // Prevent MIME-sniffing.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Don't leak the full referrer to third parties.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Disable powerful browser features we don't use.
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), interest-cohort=()" },
  // Force HTTPS for a year, including subdomains.
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }
];

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  }
};

export default nextConfig;
