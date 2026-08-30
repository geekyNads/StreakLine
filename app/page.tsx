import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { SignInButton } from "@/components/SignInButton";
import { ThemeToggle } from "@/components/ThemeToggle";

export default async function Home() {
  const session = await getServerSession(authOptions);
  if (session) redirect("/dashboard");

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center px-4 py-16 sm:px-6 sm:py-24">
      <div className="flex items-center justify-between">
        <p className="font-mono text-xs uppercase tracking-tightest text-graphite">streakline</p>
        <ThemeToggle />
      </div>

      <h1 className="mt-4 text-4xl font-semibold leading-tight tracking-tightest sm:text-5xl">
        Your commit streak,
        <br />
        without the noise.
      </h1>

      <p className="mt-5 max-w-md text-graphite">
        Connect your GitHub account to see your streak, contribution graph, language breakdown,
        and more — with nothing stored unless you choose to share it.
      </p>

      <div className="mt-10">
        <SignInButton />
      </div>

      <dl className="mt-16 grid grid-cols-1 gap-6 border-t border-hairline pt-8 font-mono text-xs text-graphite dark:border-white/10 sm:grid-cols-3">
        <div>
          <dt className="text-ink dark:text-paper">read-only</dt>
          <dd className="mt-1">Requests only the read:user scope. No repo or write access.</dd>
        </div>
        <div>
          <dt className="text-ink dark:text-paper">nothing stored by default</dt>
          <dd className="mt-1">
            Your data is fetched on load and never saved — unless you opt into the public
            leaderboard, which is off by default.
          </dd>
        </div>
        <div>
          <dt className="text-ink dark:text-paper">token stays server-side</dt>
          <dd className="mt-1">Your GitHub token never reaches the browser.</dd>
        </div>
      </dl>

      <a
        href="/changelog"
        className="mt-8 font-mono text-xs text-graphite underline decoration-hairline underline-offset-4 hover:text-ink dark:hover:text-paper"
      >
        project changelog →
      </a>
    </main>
  );
}
