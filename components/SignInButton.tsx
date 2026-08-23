"use client";

import { signIn } from "next-auth/react";

export function SignInButton() {
  return (
    <button
      onClick={() => signIn("github", { callbackUrl: "/dashboard" })}
      className="group inline-flex items-center gap-2 rounded-none border border-ink bg-ink px-5 py-3 font-mono text-sm text-paper transition-colors hover:bg-paper hover:text-ink dark:border-paper dark:bg-paper dark:text-ink dark:hover:bg-ink dark:hover:text-paper"
    >
      connect --github
      <span className="caret text-current opacity-0 transition-opacity group-hover:opacity-100" />
    </button>
  );
}
