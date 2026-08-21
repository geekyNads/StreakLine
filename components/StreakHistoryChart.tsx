import type { WeeklyStreakPoint } from "@/lib/streak";

export function StreakHistoryChart({ points }: { points: WeeklyStreakPoint[] }) {
  if (points.length === 0) return null;

  const width = 600;
  const height = 90;
  const padding = 4;
  const max = Math.max(1, ...points.map((p) => p.runLength));
  const stepX = (width - padding * 2) / Math.max(1, points.length - 1);

  const coords = points.map((p, i) => {
    const x = padding + i * stepX;
    const y = height - padding - (p.runLength / max) * (height - padding * 2);
    return { x, y, point: p };
  });

  const path = coords.map((c, i) => `${i === 0 ? "M" : "L"} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`).join(" ");
  const last = coords[coords.length - 1];

  return (
    <svg
      role="img"
      aria-label="Streak length over the past year"
      viewBox={`0 0 ${width} ${height}`}
      className="w-full"
      preserveAspectRatio="none"
      height={height}
    >
      <path d={path} fill="none" stroke="#30A14E" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
      {last && <circle cx={last.x} cy={last.y} r={2.5} fill="#216E39" />}
    </svg>
  );
}
