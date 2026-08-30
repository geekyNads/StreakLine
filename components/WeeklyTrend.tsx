import { weeklyTrend, type WeeklySummary } from "@/lib/insights";

export function WeeklyTrend({ weekly }: { weekly: WeeklySummary[] }) {
  const trend = weeklyTrend(weekly);
  if (!trend) return null;

  const diff = trend.thisWeek - trend.recentAverage;
  const pct = trend.recentAverage > 0 ? Math.round((diff / trend.recentAverage) * 100) : null;
  const direction = diff > 0 ? "up" : diff < 0 ? "down" : "flat";

  return (
    <p className="font-mono text-xs text-graphite">
      This week: {trend.thisWeek} contributions — {direction}
      {pct !== null && direction !== "flat" ? ` ${Math.abs(pct)}%` : ""} vs. your last 4-week average (
      {trend.recentAverage.toFixed(1)}).
    </p>
  );
}
