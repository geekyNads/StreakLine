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
