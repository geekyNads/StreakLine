import type { Metadata } from "next";
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
// wrong theme on load. This exact string's SHA-256 hash is allowlisted in
// next.config.mjs's CSP (script-src) — if you edit it, recompute the hash
// or the script will be silently blocked in production.
const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem('streakline-theme');if(!t){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}if(t==='dark'){document.documentElement.classList.add('dark');}}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${mono.variable} ${sans.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="bg-paper font-sans text-ink transition-colors dark:bg-ink dark:text-paper">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}

