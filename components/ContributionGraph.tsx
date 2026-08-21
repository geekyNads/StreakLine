import type { ContributionDay } from "@/lib/github";

const CELL = 11;
const GAP = 3;
const STEP = CELL + GAP;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function levelFor(count: number, max: number) {
  if (count === 0) return 0;
  if (max <= 0) return 1;
  const ratio = count / max;
  if (ratio > 0.75) return 4;
  if (ratio > 0.5) return 3;
  if (ratio > 0.25) return 2;
  return 1;
}

const LEVEL_COLOR = ["#EBEDF0", "#9BE9A8", "#40C463", "#30A14E", "#216E39"];

export function ContributionGraph({ weeks }: { weeks: ContributionDay[][] }) {
  const max = Math.max(1, ...weeks.flat().map((d) => d.count));
  const todayStr = new Date().toISOString().slice(0, 10);
  const width = weeks.length * STEP;
  const height = 7 * STEP;

  let lastMonth = -1;
  const monthLabels: { x: number; label: string }[] = [];
  weeks.forEach((week, wi) => {
    const first = week[0];
    if (!first) return;
    const m = new Date(first.date).getUTCMonth();
    if (m !== lastMonth) {
      monthLabels.push({ x: wi * STEP, label: MONTHS[m] ?? "" });
      lastMonth = m;
    }
  });

  return (
    <div className="overflow-x-auto">
      <svg
        role="img"
        aria-label="GitHub contribution graph for the past year"
        width={width}
        height={height + 18}
        viewBox={`0 0 ${width} ${height + 18}`}
      >
        <g transform="translate(0, 18)">
          {weeks.map((week, wi) =>
            week.map((day, di) => {
              const level = levelFor(day.count, max);
              const isToday = day.date === todayStr;
              const classes = [
                level === 0 ? "fill-grid-0 dark:fill-white/10" : "",
                isToday ? "stroke-ink dark:stroke-paper" : ""
              ]
                .filter(Boolean)
                .join(" ");
              return (
                <rect
                  key={day.date}
                  x={wi * STEP}
                  y={di * STEP}
                  width={CELL}
                  height={CELL}
                  rx={2}
                  fill={level === 0 ? undefined : LEVEL_COLOR[level]}
                  className={classes}
                  stroke={isToday ? "currentColor" : "none"}
                  strokeWidth={isToday ? 1.5 : 0}
                >
                  <title>
                    {day.count} contribution{day.count === 1 ? "" : "s"} on {day.date}
                  </title>
                </rect>
              );
            })
          )}
        </g>
        {monthLabels.map(({ x, label }) => (
          <text key={x} x={x} y={10} className="font-mono" fontSize={10} fill="#6B7280">
            {label}
          </text>
        ))}
      </svg>
    </div>
  );
}
