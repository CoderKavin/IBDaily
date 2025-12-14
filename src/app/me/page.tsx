"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Nav from "@/components/Nav";
import { PageContainer, Card, StatCard } from "@/components/ui";

type CalendarDay = {
  dateKey: string;
  status: "on-time" | "late" | "missed";
};

type TodaySubmission = {
  id: string;
  dateKey: string;
} | null;

type ProgressData = {
  streak: number;
  calendar: CalendarDay[];
  todayKey: string;
  todaySubmission: TodaySubmission;
  cohort: { id: string; name: string };
  bestStreak: number;
  bestRank: number | null;
};

function MeContent() {
  const searchParams = useSearchParams();
  const cohortId = searchParams.get("cohortId");
  const [data, setData] = useState<ProgressData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProgress = useCallback(async () => {
    if (!cohortId) return;

    try {
      const res = await fetch(`/api/me?cohortId=${cohortId}`);
      const result = await res.json();
      if (res.ok) {
        setData(result);
      }
    } catch {
      console.error("Failed to fetch progress");
    } finally {
      setLoading(false);
    }
  }, [cohortId]);

  useEffect(() => {
    fetchProgress();
  }, [fetchProgress]);

  if (!cohortId) {
    return (
      <>
        <Nav />
        <PageContainer>
          <p className="text-neutral-500">Please select a cohort first.</p>
        </PageContainer>
      </>
    );
  }

  if (loading) {
    return (
      <>
        <Nav />
        <PageContainer>
          <div className="flex items-center justify-center py-16">
            <div className="w-5 h-5 border-2 border-neutral-300 border-t-neutral-600 rounded-full animate-spin" />
          </div>
        </PageContainer>
      </>
    );
  }

  if (!data) {
    return (
      <>
        <Nav />
        <PageContainer>
          <p className="text-neutral-500">Failed to load progress.</p>
        </PageContainer>
      </>
    );
  }

  // Group calendar by weeks for display
  const weeks: CalendarDay[][] = [];
  for (let i = 0; i < data.calendar.length; i += 7) {
    weeks.push(data.calendar.slice(i, i + 7));
  }

  // Calculate stats
  const onTimeCount = data.calendar.filter(
    (d) => d.status === "on-time",
  ).length;
  const lateCount = data.calendar.filter((d) => d.status === "late").length;
  const missedCount = data.calendar.filter((d) => d.status === "missed").length;

  // Streak comparison - factual, not shaming
  const streakDiff = data.bestStreak - data.streak;
  const streakComparison =
    streakDiff > 0
      ? `${streakDiff} day${streakDiff !== 1 ? "s" : ""} from your best`
      : data.streak > 0 && data.streak === data.bestStreak
        ? "Personal best"
        : undefined;

  return (
    <>
      <Nav />
      <PageContainer>
        {/* Header */}
        <div className="mb-8">
          <p className="text-xs font-medium uppercase tracking-wider text-neutral-400 mb-1">
            {data.cohort.name}
          </p>
          <h1 className="text-2xl font-semibold text-neutral-900 dark:text-white">
            Progress
          </h1>
        </div>

        {/* Primary Stats */}
        <Card padding="lg">
          <div className="grid grid-cols-3 gap-6">
            <div className="text-center">
              <StatCard
                value={data.streak}
                label={data.streak === 1 ? "day" : "days"}
                sublabel={streakComparison}
                size="lg"
              />
            </div>
            <div className="text-center border-l border-neutral-100 dark:border-neutral-700">
              <StatCard
                value={data.bestStreak}
                label="best streak"
                size="md"
                muted={data.streak === data.bestStreak}
              />
            </div>
            <div className="text-center border-l border-neutral-100 dark:border-neutral-700">
              <StatCard
                value={data.bestRank ? `#${data.bestRank}` : "—"}
                label="best rank"
                size="md"
                muted={!data.bestRank}
              />
            </div>
          </div>
        </Card>

        {/* Calendar Grid */}
        <div className="mt-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-medium text-neutral-600 dark:text-neutral-400">
              Last 30 days
            </h2>
            <div className="flex items-center gap-4 text-xs text-neutral-400">
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-sm bg-emerald-500" />
                <span>On-time</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-sm bg-amber-400" />
                <span>Late</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-sm bg-neutral-200 dark:bg-neutral-700" />
                <span>Missed</span>
              </div>
            </div>
          </div>

          <Card padding="md">
            <div className="space-y-1.5">
              {weeks.map((week, weekIdx) => (
                <div key={weekIdx} className="flex gap-1.5">
                  {week.map((day) => {
                    const statusColor =
                      day.status === "on-time"
                        ? "bg-emerald-500"
                        : day.status === "late"
                          ? "bg-amber-400"
                          : "bg-neutral-200 dark:bg-neutral-700";

                    return (
                      <div
                        key={day.dateKey}
                        className={`
                          flex-1 aspect-square rounded-md ${statusColor}
                          transition-transform hover:scale-105
                          cursor-default
                        `}
                        title={day.dateKey}
                      />
                    );
                  })}
                  {/* Fill remaining slots if week is incomplete */}
                  {week.length < 7 &&
                    Array(7 - week.length)
                      .fill(null)
                      .map((_, i) => (
                        <div
                          key={`empty-${i}`}
                          className="flex-1 aspect-square"
                        />
                      ))}
                </div>
              ))}
            </div>

            {/* Summary stats */}
            <div className="mt-6 pt-4 border-t border-neutral-100 dark:border-neutral-700/50">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-xl font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                    {onTimeCount}
                  </p>
                  <p className="text-xs text-neutral-500">on-time</p>
                </div>
                <div>
                  <p className="text-xl font-semibold tabular-nums text-amber-600 dark:text-amber-400">
                    {lateCount}
                  </p>
                  <p className="text-xs text-neutral-500">late</p>
                </div>
                <div>
                  <p className="text-xl font-semibold tabular-nums text-neutral-400">
                    {missedCount}
                  </p>
                  <p className="text-xs text-neutral-500">missed</p>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </PageContainer>
    </>
  );
}

export default function MePage() {
  return (
    <Suspense
      fallback={
        <PageContainer>
          <div className="flex items-center justify-center py-16">
            <div className="w-5 h-5 border-2 border-neutral-300 border-t-neutral-600 rounded-full animate-spin" />
          </div>
        </PageContainer>
      }
    >
      <MeContent />
    </Suspense>
  );
}
