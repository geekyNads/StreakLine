import type { MonthlySummary } from "@/lib/insights";

export function MonthlyInsights({ months }: { months: MonthlySummary[] }) {
  const recent = months.slice(-6);
  if (recent.length === 0) return null;
  const max = Math.max(1, ...recent.map((m) => m.total));

  return (
    <div className="space-y-2 font-mono text-xs">
      {recent.map((m) => (
        <div key={m.month} className="flex items-center gap-3">
          <span className="w-16 shrink-0 text-graphite">{m.label}</span>
          <div className="h-2 flex-1 rounded-full bg-hairline dark:bg-white/10">
            <div
              className="h-2 rounded-full bg-grid-3"
              style={{ width: `${Math.max(4, (m.total / max) * 100)}%` }}
            />
          </div>
          <span className="w-24 shrink-0 text-right text-graphite">
            {m.total} · {m.activeDays}d active
          </span>
        </div>
      ))}
    </div>
  );
}
