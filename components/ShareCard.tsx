"use client";

import { useEffect, useState } from "react";

export function ShareCard({ login }: { login: string }) {
  const [copied, setCopied] = useState(false);
  const [status, setStatus] = useState<"checking" | "ready" | "not-configured" | "error">("checking");
  const path = `/card/${login}`;
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setOrigin(window.location.origin);
    fetch(path)
      .then((res) => {
        if (res.status === 501) setStatus("not-configured");
        else if (res.ok) setStatus("ready");
        else setStatus("error");
      })
      .catch(() => setStatus("error"));
  }, [path]);

  const markdown = `![streakline](${origin}${path})`;

  async function copy() {
    await navigator.clipboard.writeText(markdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  if (status === "checking") {
    return <p className="text-xs text-graphite">checking…</p>;
  }

  if (status === "not-configured") {
    return (
      <p className="text-xs text-graphite">
        Sharing isn't turned on for this instance yet — the person running it hasn't set up a
        public data token for it.
      </p>
    );
  }

  if (status === "error") {
    return <p className="text-xs text-graphite">Couldn't generate a card right now.</p>;
  }

  return (
    <div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={path}
        alt={`${login}'s streak card`}
        width={600}
        height={200}
        className="w-full max-w-md rounded border border-hairline dark:border-white/10"
      />
      <div className="mt-3 flex items-center gap-3">
        <code className="flex-1 truncate border border-hairline bg-hairline/30 px-2 py-1 font-mono text-xs dark:border-white/10 dark:bg-white/5">
          {markdown}
        </code>
        <button
          onClick={copy}
          className="shrink-0 font-mono text-xs text-graphite underline decoration-hairline underline-offset-4 hover:text-ink dark:hover:text-paper"
        >
          {copied ? "copied" : "copy"}
        </button>
      </div>
      <p className="mt-2 text-xs text-graphite">
        Public and read-only — anyone with this link can view this card, same as your GitHub profile.
      </p>
    </div>
  );
}
