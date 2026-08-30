"use client";

import { useCallback, useEffect, useState } from "react";
import { usePolling } from "@/hooks/usePolling";
import { LiveIndicator } from "@/components/LiveIndicator";
import type { ProjectPR, ProjectPRCounts } from "@/lib/projectPRs";

type State =
  | { status: "loading" }
  | { status: "disabled" }
  | { status: "error"; message: string }
  | { status: "ready"; prs: ProjectPR[]; counts: ProjectPRCounts };

const STATE_STYLE: Record<ProjectPR["state"], string> = {
  merged: "border-ink bg-ink text-paper dark:border-paper dark:bg-paper dark:text-ink",
  open: "border-grid-3 text-grid-3",
  closed: "border-hairline text-graphite dark:border-white/10"
};

export function Changelog() {
  const [state, setState] = useState<State>({ status: "loading" });
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/project-prs");
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Could not load PR history.");
      if (!body.enabled) {
        setState({ status: "disabled" });
        return;
      }
      setState({ status: "ready", prs: body.prs, counts: body.counts });
      setLastUpdated(Date.now());
    } catch (err) {
      setState((prev) => (prev.status === "ready" ? prev : { status: "error", message: (err as Error).message }));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  usePolling(load, 120_000, state.status !== "disabled");

  if (state.status === "loading") {
    return <p className="mt-10 font-mono text-sm text-graphite">loading…</p>;
  }

  if (state.status === "disabled") {
    return (
      <p className="mt-10 font-mono text-sm text-graphite">
        Project PR history isn't configured for this instance — the person running it hasn't set
        a GITHUB_PROJECT_REPO.
      </p>
    );
  }

  if (state.status === "error") {
    return <p className="mt-10 font-mono text-sm text-graphite">{state.message}</p>;
  }

  const { prs, counts } = state;

  return (
    <div className="mt-10">
      <div className="flex flex-wrap items-center gap-6 font-mono text-sm">
        <span>{counts.open} open</span>
        <span>{counts.merged} merged</span>
        <span>{counts.closed} closed</span>
        <LiveIndicator lastUpdated={lastUpdated} />
      </div>

      <ul className="mt-6 divide-y divide-hairline border-t border-hairline font-mono text-sm dark:divide-white/10 dark:border-white/10">
        {prs.map((pr) => (
          <li key={pr.number} className="flex items-center gap-3 py-3">
            <span className={"shrink-0 border px-2 py-0.5 text-xs " + STATE_STYLE[pr.state]}>{pr.state}</span>
            <a href={pr.url} target="_blank" rel="noreferrer noopener" className="flex-1 truncate hover:underline">
              #{pr.number} {pr.title}
            </a>
            <span className="shrink-0 text-xs text-graphite">@{pr.author}</span>
          </li>
        ))}
      </ul>

      {prs.length === 0 && <p className="mt-6 font-mono text-xs text-graphite">No pull requests yet.</p>}
    </div>
  );
}
