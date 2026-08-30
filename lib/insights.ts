import type { ContributionDay } from "./github";

export type MonthlySummary = {
  month: string; // "2026-08"
  label: string; // "Aug 2026"
  total: number;
  activeDays: number;
};

export function computeMonthlySummaries(days: ContributionDay[]): MonthlySummary[] {
  const byMonth = new Map<string, { total: number; activeDays: number }>();

  for (const day of days) {
    const key = day.date.slice(0, 7); // "YYYY-MM"
    const existing = byMonth.get(key) ?? { total: 0, activeDays: 0 };
    existing.total += day.count;
    if (day.count > 0) existing.activeDays += 1;
    byMonth.set(key, existing);
  }

  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  return [...byMonth.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, v]) => {
      const [year, m] = month.split("-");
      return { month, label: `${MONTHS[Number(m) - 1]} ${year}`, ...v };
    });
}

export type WeeklySummary = {
  weekEnding: string;
  total: number;
  activeDays: number;
};

export function computeWeeklySummaries(weeks: ContributionDay[][]): WeeklySummary[] {
  return weeks.map((week) => {
    const total = week.reduce((sum, d) => sum + d.count, 0);
    const activeDays = week.filter((d) => d.count > 0).length;
    const last = week[week.length - 1];
    return { weekEnding: last?.date ?? "", total, activeDays };
  });
}

/** This week vs. the average of the prior 4 weeks — a simple, honest "trending up/down" signal. */
export function weeklyTrend(weekly: WeeklySummary[]): { thisWeek: number; recentAverage: number } | null {
  if (weekly.length < 2) return null;
  const thisWeek = weekly[weekly.length - 1]?.total ?? 0;
  const priorFour = weekly.slice(-5, -1);
  if (priorFour.length === 0) return null;
  const recentAverage = priorFour.reduce((sum, w) => sum + w.total, 0) / priorFour.length;
  return { thisWeek, recentAverage };
}
