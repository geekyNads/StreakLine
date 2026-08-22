import type { Metadata } from "next";
import { headers } from "next/headers";
import { IBM_Plex_Mono, Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";

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
  robots: { index: true, follow: true }
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
      </body>
    </html>
  );
}
