"use client";

import { useEffect, useRef, useState } from "react";

export function CountUp({ value, durationMs = 600 }: { value: number; durationMs?: number }) {
  const [display, setDisplay] = useState(0);
  const start = useRef<number | null>(null);

  useEffect(() => {
    // Respect reduced-motion preference: jump straight to the value.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setDisplay(value);
      return;
    }

    start.current = null;
    let frame: number;

    function tick(timestamp: number) {
      if (start.current === null) start.current = timestamp;
      const progress = Math.min(1, (timestamp - start.current) / durationMs);
      const eased = 1 - (1 - progress) * (1 - progress);
      setDisplay(Math.round(eased * value));
      if (progress < 1) frame = requestAnimationFrame(tick);
    }

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, durationMs]);

  return <>{display}</>;
}
