"use client";

import { useEffect, useState } from "react";

const THEMES = ["light", "dark", "dracula"] as const;
type ThemeName = (typeof THEMES)[number];

type Prefs = { theme: ThemeName; accent: string; bg: string; useCustom: boolean };
const DEFAULT_PREFS: Prefs = { theme: "light", accent: "#216E39", bg: "#FAFAF7", useCustom: false };
const KEY = "streakline-card-prefs";

export function ShareCard({ login }: { login: string }) {
  const [copied, setCopied] = useState(false);
  const [status, setStatus] = useState<"checking" | "ready" | "not-configured" | "error">("checking");
  const [origin, setOrigin] = useState("");
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);

  useEffect(() => {
    setOrigin(window.location.origin);
    const stored = window.localStorage.getItem(KEY);
    if (stored) {
      try {
        setPrefs({ ...DEFAULT_PREFS, ...JSON.parse(stored) });
      } catch {
        /* ignore malformed local storage, fall back to defaults */
      }
    }
  }, []);

  function updatePrefs(next: Partial<Prefs>) {
    setPrefs((prev) => {
      const merged = { ...prev, ...next };
      window.localStorage.setItem(KEY, JSON.stringify(merged));
      return merged;
    });
  }

  const params = new URLSearchParams({ theme: prefs.theme });
  if (prefs.useCustom) {
    params.set("accent", prefs.accent.replace("#", ""));
    params.set("bg", prefs.bg.replace("#", ""));
  }
  const path = `/card/${login}?${params.toString()}`;
  const badgePath = `/badge/${login}`;

  useEffect(() => {
    setStatus("checking");
    fetch(path)
      .then((res) => {
        if (res.status === 501) setStatus("not-configured");
        else if (res.ok) setStatus("ready");
        else setStatus("error");
      })
      .catch(() => setStatus("error"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path]);

  async function copy(text: string) {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  if (status === "not-configured") {
    return (
      <p className="text-xs text-graphite">
        Sharing isn't turned on for this instance yet — the person running it hasn't set up a
        public data token for it.
      </p>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        {THEMES.map((t) => (
          <button
            key={t}
            onClick={() => updatePrefs({ theme: t, useCustom: false })}
            className={
              "border px-3 py-1 font-mono text-xs capitalize " +
              (prefs.theme === t && !prefs.useCustom
                ? "border-ink bg-ink text-paper dark:border-paper dark:bg-paper dark:text-ink"
                : "border-hairline text-graphite hover:text-ink dark:border-white/10 dark:hover:text-paper")
            }
          >
            {t}
          </button>
        ))}
        <button
          onClick={() => updatePrefs({ useCustom: true })}
          className={
            "border px-3 py-1 font-mono text-xs " +
            (prefs.useCustom
              ? "border-ink bg-ink text-paper dark:border-paper dark:bg-paper dark:text-ink"
              : "border-hairline text-graphite hover:text-ink dark:border-white/10 dark:hover:text-paper")
          }
        >
          custom
        </button>
      </div>

      {prefs.useCustom && (
        <div className="mt-3 flex items-center gap-4 font-mono text-xs text-graphite">
          <label className="flex items-center gap-2">
            accent
            <input
              type="color"
              value={prefs.accent}
              onChange={(e) => updatePrefs({ accent: e.target.value })}
              className="h-6 w-8 cursor-pointer border border-hairline bg-transparent dark:border-white/10"
            />
          </label>
          <label className="flex items-center gap-2">
            background
            <input
              type="color"
              value={prefs.bg}
              onChange={(e) => updatePrefs({ bg: e.target.value })}
              className="h-6 w-8 cursor-pointer border border-hairline bg-transparent dark:border-white/10"
            />
          </label>
        </div>
      )}

      <div className="mt-4">
        {status === "checking" && <p className="text-xs text-graphite">checking…</p>}
        {status === "error" && <p className="text-xs text-graphite">Couldn't generate a card right now.</p>}
        {status === "ready" && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={path}
            alt={`${login}'s streak card`}
            width={600}
            height={200}
            className="w-full max-w-md rounded border border-hairline dark:border-white/10"
          />
        )}
      </div>

      <div className="mt-3 flex items-center gap-3">
        <code className="flex-1 truncate border border-hairline bg-hairline/30 px-2 py-1 font-mono text-xs dark:border-white/10 dark:bg-white/5">
          ![streakline]({origin}
          {path})
        </code>
        <button
          onClick={() => copy(`![streakline](${origin}${path})`)}
          className="shrink-0 font-mono text-xs text-graphite underline decoration-hairline underline-offset-4 hover:text-ink dark:hover:text-paper"
        >
          {copied ? "copied" : "copy"}
        </button>
      </div>

      <div className="mt-3 flex items-center gap-3">
        <code className="flex-1 truncate border border-hairline bg-hairline/30 px-2 py-1 font-mono text-xs dark:border-white/10 dark:bg-white/5">
          ![streak]({origin}
          {badgePath})
        </code>
        <button
          onClick={() => copy(`![streak](${origin}${badgePath})`)}
          className="shrink-0 font-mono text-xs text-graphite underline decoration-hairline underline-offset-4 hover:text-ink dark:hover:text-paper"
        >
          {copied ? "copied" : "copy badge"}
        </button>
      </div>

      <p className="mt-2 text-xs text-graphite">
        Public and read-only — anyone with this link can view this card, same as your GitHub profile.
      </p>
    </div>
  );
}
