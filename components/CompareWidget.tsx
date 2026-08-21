"use client";

import { useState } from "react";

type CompareResult = {
  login: string;
  avatarUrl: string;
  totalContributions: number;
  current: number;
  longest: number;
};

export function CompareWidget({ self }: { self: { login: string; current: number; longest: number } }) {
  const [username, setUsername] = useState("");
  const [state, setState] = useState<
    { status: "idle" } | { status: "loading" } | { status: "error"; message: string } | { status: "ready"; data: CompareResult }
  >({ status: "idle" });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = username.trim().replace(/^@/, "");
    if (!trimmed) return;

    setState({ status: "loading" });
    try {
      const res = await fetch(`/api/compare?username=${encodeURIComponent(trimmed)}`);
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Something went wrong.");
      setState({ status: "ready", data: body });
    } catch (err) {
      setState({ status: "error", message: (err as Error).message });
    }
  }

  return (
    <div>
      <form onSubmit={submit} className="flex gap-2">
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="github-username"
          className="w-full border border-hairline bg-transparent px-3 py-2 font-mono text-sm outline-none focus:border-ink dark:border-white/10 dark:focus:border-paper"
        />
        <button
          type="submit"
          className="shrink-0 border border-ink px-4 py-2 font-mono text-sm hover:bg-ink hover:text-paper dark:border-paper dark:hover:bg-paper dark:hover:text-ink"
        >
          compare
        </button>
      </form>

      {state.status === "loading" && <p className="mt-4 font-mono text-xs text-graphite">looking up…</p>}
      {state.status === "error" && <p className="mt-4 font-mono text-xs text-graphite">{state.message}</p>}

      {state.status === "ready" && (
        <div className="mt-6 grid grid-cols-2 gap-6 font-mono text-sm">
          <div>
            <div className="text-xs text-graphite">@{self.login}</div>
            <div className="mt-1 text-2xl font-semibold">{self.current}d</div>
            <div className="text-xs text-graphite">longest {self.longest}d</div>
          </div>
          <div>
            <div className="text-xs text-graphite">@{state.data.login}</div>
            <div className="mt-1 text-2xl font-semibold">{state.data.current}d</div>
            <div className="text-xs text-graphite">longest {state.data.longest}d</div>
          </div>
        </div>
      )}
    </div>
  );
}
