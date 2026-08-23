"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ContributionGraph } from "@/components/ContributionGraph";
import { StreakHistoryChart } from "@/components/StreakHistoryChart";
import { LanguageBreakdown } from "@/components/LanguageBreakdown";
import { TopRepos } from "@/components/TopRepos";
import { ShareCard } from "@/components/ShareCard";
import { CompareWidget } from "@/components/CompareWidget";
import { Leaderboard } from "@/components/Leaderboard";
import { CountUp } from "@/components/CountUp";
import { DashboardSkeleton } from "@/components/DashboardSkeleton";
import { GraceDayToggle, useGraceDays } from "@/components/GraceDayToggle";
import { Milestones } from "@/components/Milestones";
import { MonthlyInsights } from "@/components/MonthlyInsights";
import { WeeklyTrend } from "@/components/WeeklyTrend";
import { NotifyCheckbox } from "@/components/NotifyCheckbox";
import { LiveIndicator } from "@/components/LiveIndicator";
import { usePolling } from "@/hooks/usePolling";
import { computeStreaks, computeWeeklyStreakHistory } from "@/lib/streak";
import { computeMilestoneStatus, nextMilestone } from "@/lib/milestones";
import { computeMonthlySummaries, computeWeeklySummaries } from "@/lib/insights";
import type { ContributionData, RepoBreakdown } from "@/lib/github";

type ContribState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; data: ContributionData };

type RepoState = { status: "loading" | "error" | "ready"; data?: RepoBreakdown };

// How often the dashboard quietly refreshes itself. Streak data doesn't
// change second to second, so this favors not wasting GitHub API calls
// over shaving the delay down further — polling only runs while the tab
// is actually visible anyway (see usePolling).
const REFRESH_INTERVAL_MS = 120_000;

export function DashboardData() {
  const [contrib, setContrib] = useState<ContribState>({ status: "loading" });
  const [repos, setRepos] = useState<RepoState>({ status: "loading" });
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [graceDays, setGraceDays] = useGraceDays();
  const hasLoadedOnce = useRef(false);

  const loadContributions = useCallback(async (isBackground: boolean) => {
    if (!isBackground) setContrib({ status: "loading" });
    try {
      const res = await fetch("/api/contributions");
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Something went wrong.");
      }
      const data: ContributionData = await res.json();
      setContrib({ status: "ready", data });
      setLastUpdated(Date.now());
    } catch (err) {
      // A background refresh failing shouldn't blow away a working
      // dashboard — only the initial load surfaces a full error state.
      if (!isBackground) setContrib({ status: "error", message: (err as Error).message });
    }
  }, []);

  const loadRepos = useCallback(async () => {
    try {
      const res = await fetch("/api/repo-breakdown");
      if (!res.ok) throw new Error();
      const data: RepoBreakdown = await res.json();
      setRepos({ status: "ready", data });
    } catch {
      setRepos((prev) => (prev.status === "ready" ? prev : { status: "error" }));
    }
  }, []);

  useEffect(() => {
    loadContributions(false);
    loadRepos();
    hasLoadedOnce.current = true;
  }, [loadContributions, loadRepos]);

  usePolling(() => loadContributions(true), REFRESH_INTERVAL_MS);
  usePolling(loadRepos, REFRESH_INTERVAL_MS);

  if (contrib.status === "loading") return <DashboardSkeleton />;

  if (contrib.status === "error") {
    return (
      <div className="mt-10">
        <p className="font-mono text-sm text-graphite">{contrib.message}</p>
        <button
          onClick={() => loadContributions(false)}
          className="mt-3 font-mono text-xs underline decoration-hairline underline-offset-4 hover:text-ink dark:hover:text-paper"
        >
          try again
        </button>
      </div>
    );
  }

  const { data } = contrib;
  const { current, longest } = computeStreaks(data.days, graceDays);
  const history = computeWeeklyStreakHistory(data.weeks, graceDays);
  const milestones = computeMilestoneStatus(current, longest);
  const upNext = nextMilestone(current);
  const months = computeMonthlySummaries(data.days);
  const weeks = computeWeeklySummaries(data.weeks);

  return (
    <div className="mt-10 space-y-12 sm:space-y-14">
      <section>
        <div className="flex items-center justify-between">
          <div className="grid flex-1 grid-cols-1 gap-6 font-mono sm:grid-cols-3">
            <Stat label="current streak" value={current} suffix="d" />
            <Stat label="longest streak" value={longest} suffix="d" />
            <Stat label="past year" value={data.totalContributions} suffix="" />
          </div>
        </div>
        <div className="mt-6 flex flex-wrap items-center gap-4">
          <GraceDayToggle value={graceDays} onChange={setGraceDays} />
          <NotifyCheckbox />
          <LiveIndicator lastUpdated={lastUpdated} />
        </div>
      </section>

      <section>
        <SectionHeading>milestones</SectionHeading>
        <div className="mt-4">
          <Milestones
            milestones={milestones}
            upNext={upNext ? `${upNext.daysRemaining}d to ${upNext.milestone.label}` : "all milestones reached"}
          />
        </div>
      </section>

      <section>
        <SectionHeading>contribution graph</SectionHeading>
        <div className="mt-4">
          <ContributionGraph weeks={data.weeks} />
        </div>
      </section>

      <section>
        <SectionHeading>streak over time</SectionHeading>
        <div className="mt-4">
          <StreakHistoryChart points={history} />
        </div>
      </section>

      <section>
        <SectionHeading>monthly insights</SectionHeading>
        <div className="mt-4 space-y-3">
          <WeeklyTrend weekly={weeks} />
          <MonthlyInsights months={months} />
        </div>
      </section>

      {repos.status === "ready" && repos.data && repos.data.languages.length > 0 && (
        <section>
          <SectionHeading>languages</SectionHeading>
          <div className="mt-4">
            <LanguageBreakdown data={repos.data} />
          </div>
        </section>
      )}

      {repos.status === "ready" && repos.data && repos.data.repos.length > 0 && (
        <section>
          <SectionHeading>repository activity</SectionHeading>
          <div className="mt-4 overflow-x-auto">
            <TopRepos data={repos.data} />
          </div>
        </section>
      )}

      <section>
        <SectionHeading>share your streak</SectionHeading>
        <div className="mt-4">
          <ShareCard login={data.login} />
        </div>
      </section>

      <section>
        <SectionHeading>compare with a friend</SectionHeading>
        <div className="mt-4">
          <CompareWidget self={{ login: data.login, current, longest }} />
        </div>
      </section>

      <section>
        <SectionHeading>leaderboard</SectionHeading>
        <div className="mt-4">
          <Leaderboard />
        </div>
      </section>
    </div>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="border-t border-hairline pt-6 font-mono text-xs uppercase tracking-tightest text-graphite dark:border-white/10">
      {children}
    </h2>
  );
}

function Stat({ label, value, suffix }: { label: string; value: number; suffix: string }) {
  return (
    <div>
      <div className="text-3xl font-semibold tracking-tightest">
        <CountUp value={value} />
        <span className="text-lg text-graphite">{suffix}</span>
      </div>
      <div className="mt-1 text-xs text-graphite">{label}</div>
    </div>
  );
}
