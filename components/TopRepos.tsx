import type { RepoBreakdown } from "@/lib/github";

export function TopRepos({ data }: { data: RepoBreakdown }) {
  if (data.repos.length === 0) return null;

  return (
    <ul className="divide-y divide-hairline font-mono text-xs dark:divide-white/10">
      {data.repos.slice(0, 5).map((repo) => (
        <li key={repo.name} className="flex items-center justify-between py-2">
          <a
            href={repo.url}
            target="_blank"
            rel="noreferrer noopener"
            className="truncate text-ink hover:underline dark:text-paper"
          >
            {repo.name}
          </a>
          <span className="ml-3 shrink-0 text-graphite">{repo.contributions} commits</span>
        </li>
      ))}
    </ul>
  );
}
