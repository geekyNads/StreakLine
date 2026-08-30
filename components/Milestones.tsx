import type { MilestoneStatus } from "@/lib/milestones";

export function Milestones({ milestones, upNext }: { milestones: MilestoneStatus[]; upNext: string | null }) {
  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {milestones.map((m) => (
          <span
            key={m.days}
            className={
              "border px-3 py-1.5 font-mono text-xs " +
              (m.reached
                ? "border-ink bg-ink text-paper dark:border-paper dark:bg-paper dark:text-ink"
                : "border-hairline text-graphite dark:border-white/10")
            }
          >
            {m.label}
          </span>
        ))}
      </div>
      {upNext && <p className="mt-3 text-xs text-graphite">{upNext}</p>}
    </div>
  );
}
