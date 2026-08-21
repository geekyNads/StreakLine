"use client";

import { useTheme } from "./ThemeProvider";

export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  return (
    <button
      onClick={toggle}
      aria-label="Toggle dark mode"
      className="font-mono text-xs text-graphite underline decoration-hairline underline-offset-4 hover:text-ink dark:hover:text-paper"
    >
      {theme === "dark" ? "light mode" : "dark mode"}
    </button>
  );
}
