export type Milestone = {
  days: number;
  label: string;
};

export const MILESTONES: Milestone[] = [
  { days: 7, label: "1 week" },
  { days: 30, label: "1 month" },
  { days: 100, label: "100 days" },
  { days: 180, label: "6 months" },
  { days: 365, label: "1 year" }
];

export type MilestoneStatus = Milestone & {
  reached: boolean; // by longest streak ever, so it stays earned even if the current streak resets
  active: boolean; // currently in progress (current streak has reached it right now)
};

export function computeMilestoneStatus(current: number, longest: number): MilestoneStatus[] {
  return MILESTONES.map((m) => ({
    ...m,
    reached: longest >= m.days,
    active: current >= m.days
  }));
}

/** The next milestone not yet reached by the current streak, and how many days remain — for a "3 days to your next badge" style prompt. */
export function nextMilestone(current: number): { milestone: Milestone; daysRemaining: number } | null {
  const next = MILESTONES.find((m) => m.days > current);
  if (!next) return null;
  return { milestone: next, daysRemaining: next.days - current };
}
