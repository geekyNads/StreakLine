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
