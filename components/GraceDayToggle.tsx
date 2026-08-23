"use client";

import { useEffect, useState } from "react";

const KEY = "streakline-grace-days";

export function useGraceDays(): [number, (value: number) => void] {
  const [grace, setGrace] = useState(0);

  useEffect(() => {
    const stored = window.localStorage.getItem(KEY);
    if (stored) setGrace(Number(stored) || 0);
  }, []);

  function update(value: number) {
    setGrace(value);
    window.localStorage.setItem(KEY, String(value));
  }

  return [grace, update];
}

export function GraceDayToggle({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const on = value > 0;
  return (
    <button
      onClick={() => onChange(on ? 0 : 1)}
      className="font-mono text-xs text-graphite underline decoration-hairline underline-offset-4 hover:text-ink dark:hover:text-paper"
    >
      grace day: {on ? "on" : "off"}
    </button>
  );
}
