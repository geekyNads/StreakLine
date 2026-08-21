"use client";

import { useEffect, useState } from "react";
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
import { computeStreaks, computeWeeklyStreakHistory } from "@/lib/streak";
import type { ContributionData, RepoBreakdown } from "@/lib/github";

type ContribState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; data: ContributionData };

type RepoState = { status: "loading" | "error" | "ready"; data?: RepoBreakdown };

export function DashboardData() {
  const [contrib, setContrib] = useState<ContribState>({ status: "loading" });
  const [repos, setRepos] = useState<RepoState>({ status: "loading" });
  const [graceDays, setGraceDays] = useGraceDays();

  function loadContributions() {
    setContrib({ status: "loading" });
    fetch("/api/contributions")
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? "Something went wrong.");
        }
        return res.json();
      })
      .then((data: ContributionData) => setContrib({ status: "ready", data }))
      .catch((err: Error) => setContrib({ status: "error", message: err.message }));
  }

  useEffect(() => {
    loadContributions();

    fetch("/api/repo-breakdown")
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data: RepoBreakdown) => setRepos({ status: "ready", data }))
      .catch(() => setRepos({ status: "error" }));
  }, []);

  if (contrib.status === "loading") return <DashboardSkeleton />;

  if (contrib.status === "error") {
    return (
      <div className="mt-10">
        <p className="font-mono text-sm text-graphite">{contrib.message}</p>
        <button
          onClick={loadContributions}
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

  return (
    <div className="mt-10 space-y-14">
      <section>
        <div className="grid grid-cols-3 gap-6 font-mono">
          <Stat label="current streak" value={current} suffix="d" />
          <Stat label="longest streak" value={longest} suffix="d" />
          <Stat label="past year" value={data.totalContributions} suffix="" />
        </div>
        <div className="mt-6">
          <GraceDayToggle value={graceDays} onChange={setGraceDays} />
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
          <SectionHeading>top repos this year</SectionHeading>
          <div className="mt-4">
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
