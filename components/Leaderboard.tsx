"use client";

import { useEffect, useState } from "react";

type Entry = { login: string; streak: number; avatarUrl: string };

export function Leaderboard() {
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [optedIn, setOptedIn] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      const res = await fetch("/api/leaderboard");
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Could not load the leaderboard.");
      setEntries(body.entries);
      setOptedIn(body.optedIn);
      setEnabled(body.enabled ?? true);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function toggle() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/leaderboard", { method: optedIn ? "DELETE" : "POST" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Something went wrong.");
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!enabled) {
    return (
      <p className="text-xs text-graphite">
        The leaderboard isn't turned on for this instance yet — the person running it hasn't set
        up storage for it.
      </p>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <p className="text-xs text-graphite">
          Opt in to show your current streak, username, and avatar publicly on this list.
        </p>
        <button
          onClick={toggle}
          disabled={busy}
          className="shrink-0 whitespace-nowrap font-mono text-xs underline decoration-hairline underline-offset-4 hover:text-ink disabled:opacity-50 dark:hover:text-paper"
        >
          {optedIn ? "leave leaderboard" : "join leaderboard"}
        </button>
      </div>

      {error && <p className="mt-3 font-mono text-xs text-graphite">{error}</p>}

      {entries && entries.length > 0 && (
        <ol className="mt-4 divide-y divide-hairline font-mono text-sm dark:divide-white/10">
          {entries.map((entry, i) => (
            <li key={entry.login} className="flex items-center gap-3 py-2">
              <span className="w-5 text-xs text-graphite">{i + 1}</span>
              {entry.avatarUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={entry.avatarUrl} alt="" width={20} height={20} className="rounded-full" />
              )}
              <span className="flex-1 truncate">@{entry.login}</span>
              <span className="text-graphite">{entry.streak}d</span>
            </li>
          ))}
        </ol>
      )}

      {entries && entries.length === 0 && (
        <p className="mt-4 font-mono text-xs text-graphite">No one's opted in yet — be the first.</p>
      )}
    </div>
  );
}
