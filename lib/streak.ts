import type { ContributionDay } from "./github";

export type StreakStats = {
  current: number;
  longest: number;
};

/** Counts a streak backward from `endIndex` (inclusive), tolerating up to `graceDays` zero days. */
function trailingStreak(days: ContributionDay[], endIndex: number, graceDays: number): number {
  let count = 0;
  let grace = graceDays;
  for (let i = endIndex; i >= 0; i -= 1) {
    const day = days[i];
    if (!day) break;
    if (day.count > 0) {
      count += 1;
    } else if (grace > 0) {
      grace -= 1;
    } else {
      break;
    }
  }
  return count;
}

/**
 * Days must be sorted ascending by date (GitHub's calendar already returns
 * them that way). `graceDays` lets a small number of zero-contribution
 * days pass without breaking a streak — think of it as a limited number
 * of "streak freezes" available per run, not unlimited tolerance, so a
 * genuinely inactive stretch still reads as broken.
 *
 * Current streak counts backward from today; if today has no
 * contributions yet, it counts from yesterday so a streak isn't marked
 * broken just because the day isn't over.
 */
export function computeStreaks(days: ContributionDay[], graceDays = 0): StreakStats {
  if (days.length === 0) return { current: 0, longest: 0 };

  let longest = 0;
  let running = 0;
  let graceLeft = graceDays;

  for (const day of days) {
    if (day.count > 0) {
      running += 1;
      longest = Math.max(longest, running);
    } else if (graceLeft > 0) {
      graceLeft -= 1;
    } else {
      running = 0;
      graceLeft = graceDays;
    }
  }

  const todayStr = new Date().toISOString().slice(0, 10);
  let end = days.length - 1;
  if (days[end]?.date === todayStr && days[end]?.count === 0) {
    end -= 1;
  }

  return { current: trailingStreak(days, end, graceDays), longest };
}

export type WeeklyStreakPoint = { weekEnding: string; runLength: number };

/**
 * One point per week: the streak run length as of that week's last day
 * (not "today" — this is historical, so no today-adjustment applies).
 * Used for the streak-over-time chart.
 */
export function computeWeeklyStreakHistory(weeks: ContributionDay[][], graceDays = 0): WeeklyStreakPoint[] {
  const flat = weeks.flat();
  const points: WeeklyStreakPoint[] = [];
  let cursor = -1;

  for (const week of weeks) {
    cursor += week.length;
    const last = week[week.length - 1];
    if (last) points.push({ weekEnding: last.date, runLength: trailingStreak(flat, cursor, graceDays) });
  }

  return points;
}
