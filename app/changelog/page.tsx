import { Changelog } from "@/components/Changelog";

export const metadata = {
  title: "streakline — changelog"
};

export default function ChangelogPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-10 sm:px-6 sm:py-16">
      <a href="/" className="font-mono text-xs text-graphite underline decoration-hairline underline-offset-4 hover:text-ink dark:hover:text-paper">
        ← streakline
      </a>
      <h1 className="mt-4 text-2xl font-semibold tracking-tightest">changelog</h1>
      <p className="mt-2 font-mono text-xs text-graphite">
        Pull request history for this project, live.
      </p>
      <Changelog />
    </main>
  );
}
