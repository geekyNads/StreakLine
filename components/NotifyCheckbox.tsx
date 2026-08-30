"use client";

import { useEffect, useState } from "react";

export function NotifyCheckbox() {
  const [enabled, setEnabled] = useState(true);
  const [subscribed, setSubscribed] = useState(false);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [showInput, setShowInput] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/notify")
      .then((res) => res.json())
      .then((body) => {
        setEnabled(body.enabled ?? true);
        setSubscribed(body.subscribed ?? false);
      })
      .catch(() => setEnabled(false));
  }, []);

  async function toggle(checked: boolean) {
    setError(null);
    if (!checked) {
      setBusy(true);
      try {
        await fetch("/api/notify", { method: "DELETE" });
        setSubscribed(false);
      } finally {
        setBusy(false);
      }
      return;
    }
    setShowInput(true);
  }

  async function confirmSubscribe(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email })
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Something went wrong.");
      setSubscribed(true);
      setShowInput(false);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!enabled) return null;

  return (
    <div className="text-xs text-graphite">
      <label className="flex cursor-pointer items-center gap-2">
        <input
          type="checkbox"
          checked={subscribed}
          disabled={busy}
          onChange={(e) => toggle(e.target.checked)}
          className="h-3 w-3 accent-graphite"
        />
        email me if my streak is at risk
      </label>

      {showInput && !subscribed && (
        <form onSubmit={confirmSubscribe} className="mt-2 flex items-center gap-2">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="border border-hairline bg-transparent px-2 py-1 font-mono text-xs outline-none focus:border-ink dark:border-white/10 dark:focus:border-paper"
          />
          <button type="submit" disabled={busy} className="underline decoration-hairline underline-offset-4 hover:text-ink dark:hover:text-paper">
            confirm
          </button>
        </form>
      )}

      {error && <p className="mt-1">{error}</p>}
    </div>
  );
}
