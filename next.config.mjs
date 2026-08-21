/** @type {import('next').NextConfig} */
const isDev = process.env.NODE_ENV !== "production";

// Next's dev server injects inline scripts and uses eval() for hot reload
// (react-refresh). Those are only needed in development — the production
// build is fully static/self-hosted JS and doesn't need either, so the
// real, strict policy only applies to `next build` / `next start`. The one
// inline script we ship on purpose (theme-init, in app/layout.tsx) is
// allowlisted by its exact SHA-256 hash instead of a blanket 'unsafe-inline'.
const THEME_SCRIPT_HASH = "'sha256-D1A2kewodEYjAwRz1Lg61LUZMkZeq6GU9j2ttw4rH/E='";
const scriptSrc = isDev
  ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
  : `script-src 'self' ${THEME_SCRIPT_HASH}`;

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
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  // Tight CSP in production; relaxed script-src only in dev (see above).
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "img-src 'self' https://avatars.githubusercontent.com data:",
      "style-src 'self' 'unsafe-inline'",
      scriptSrc,
      "connect-src 'self' https://api.github.com https://github.com",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'"
    ].join("; ")
  }
];

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  }
};

export default nextConfig;
