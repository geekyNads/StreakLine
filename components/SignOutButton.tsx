"use client";

import { signOut } from "next-auth/react";

export function SignOutButton() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: "/" })}
      className="font-mono text-xs text-graphite underline decoration-hairline underline-offset-4 hover:text-ink dark:hover:text-paper"
    >
      disconnect
    </button>
  );
}
