import type { RepoBreakdown } from "@/lib/github";

export function LanguageBreakdown({ data }: { data: RepoBreakdown }) {
  if (data.languages.length === 0) return null;
  const max = Math.max(1, ...data.languages.map((l) => l.count));

  return (
    <div className="space-y-2 font-mono text-xs">
      {data.languages.map((lang) => (
        <div key={lang.name} className="flex items-center gap-3">
          <span className="w-20 shrink-0 text-graphite">{lang.name}</span>
          <div className="h-2 flex-1 rounded-full bg-hairline dark:bg-white/10">
            <div
              className="h-2 rounded-full"
              style={{ width: `${Math.max(6, (lang.count / max) * 100)}%`, background: lang.color }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
