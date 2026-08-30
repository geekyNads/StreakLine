import type { RepoBreakdown } from "@/lib/github";

export function TopRepos({ data }: { data: RepoBreakdown }) {
  if (data.repos.length === 0) return null;
  const top = data.repos.slice(0, 8);
  const max = Math.max(1, ...top.map((r) => r.contributions));

  return (
    <div className="space-y-2 font-mono text-xs">
      {top.map((repo) => {
        const intensity = repo.contributions / max;
        return (
          <div key={repo.name} className="flex items-center gap-3">
            <a
              href={repo.url}
              target="_blank"
              rel="noreferrer noopener"
              className="w-32 shrink-0 truncate text-ink hover:underline dark:text-paper"
            >
              {repo.name}
            </a>
            <div className="flex h-2 flex-1 gap-0.5">
              {Array.from({ length: 12 }).map((_, i) => (
                <div
                  key={i}
                  className="h-2 flex-1 rounded-sm bg-hairline dark:bg-white/10"
                  style={
                    i < Math.round(intensity * 12)
                      ? { background: repo.color ?? "#30A14E" }
                      : undefined
                  }
                />
              ))}
            </div>
            <span className="w-20 shrink-0 text-right text-graphite">{repo.contributions} commits</span>
          </div>
        );
      })}
    </div>
  );
}
