"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Nav from "@/components/Nav";
import { PageContainer, Card, StatCard } from "@/components/ui";

interface DailyStats {
  dateKey: string;
  totalMembers: number;
  submittedCount: number;
  missedCount: number;
  submissionRate: number;
}

interface MemberHealth {
  userId: string;
  userName: string | null;
  userEmail: string;
  currentStreak: number;
  submissionsLast7Days: number;
  submissionsLast30Days: number;
  lastSubmissionDate: string | null;
  status: "active" | "at_risk" | "inactive";
}

interface RetentionMetrics {
  d1: number;
  d3: number;
  d7: number;
}

interface CohortHealthData {
  cohortId: string;
  cohortName: string;
  totalMembers: number;
  activeMembers: number;
  atRiskMembers: number;
  inactiveMembers: number;
  todaySubmissionRate: number;
  weeklyAverageRate: number;
  dailyStats: DailyStats[];
  memberHealth: MemberHealth[];
  retention: RetentionMetrics;
}

function DashboardContent() {
  const searchParams = useSearchParams();
  const cohortId = searchParams.get("cohortId");
  const [data, setData] = useState<CohortHealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHealth = useCallback(async () => {
    if (!cohortId) return;

    try {
      const res = await fetch(`/api/cohort-health?cohortId=${cohortId}`);
      const result = await res.json();

      if (!res.ok) {
        setError(result.error || "Failed to load dashboard");
        return;
      }

      setData(result);
    } catch {
      setError("Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  }, [cohortId]);

  useEffect(() => {
    fetchHealth();
  }, [fetchHealth]);

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

  if (error) {
    return (
      <>
        <Nav />
        <PageContainer>
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 rounded-xl p-4">
            <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
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
          <p className="text-neutral-500">No data available.</p>
        </PageContainer>
      </>
    );
  }

  const getStatusBadge = (status: MemberHealth["status"]) => {
    switch (status) {
      case "active":
        return (
          <span className="px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide rounded bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400">
            Active
          </span>
        );
      case "at_risk":
        return (
          <span className="px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide rounded bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">
            At Risk
          </span>
        );
      case "inactive":
        return (
          <span className="px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide rounded bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400">
            Inactive
          </span>
        );
    }
  };

  const formatDate = (dateKey: string) => {
    const date = new Date(dateKey);
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <>
      <Nav />
      <PageContainer size="lg">
        {/* Header */}
        <div className="mb-8">
          <p className="text-xs font-medium uppercase tracking-wider text-neutral-400 mb-1">
            {data.cohortName}
          </p>
          <h1 className="text-2xl font-semibold text-neutral-900 dark:text-white">
            Health Dashboard
          </h1>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Card padding="md">
            <StatCard
              value={data.totalMembers}
              label="Total Members"
              size="sm"
            />
          </Card>
          <Card padding="md">
            <StatCard value={data.activeMembers} label="Active" size="sm" />
          </Card>
          <Card padding="md">
            <StatCard value={data.atRiskMembers} label="At Risk" size="sm" />
          </Card>
          <Card padding="md">
            <StatCard value={data.inactiveMembers} label="Inactive" size="sm" />
          </Card>
        </div>

        {/* Submission Rates */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          <Card padding="md">
            <p className="text-xs font-medium uppercase tracking-wider text-neutral-400 mb-3">
              Today&apos;s Rate
            </p>
            <div className="flex items-end gap-3">
              <p className="text-3xl font-semibold tabular-nums text-neutral-900 dark:text-white">
                {data.todaySubmissionRate}%
              </p>
              <div className="flex-1 h-1.5 bg-neutral-100 dark:bg-neutral-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-neutral-900 dark:bg-white transition-all"
                  style={{ width: `${data.todaySubmissionRate}%` }}
                />
              </div>
            </div>
          </Card>
          <Card padding="md">
            <p className="text-xs font-medium uppercase tracking-wider text-neutral-400 mb-3">
              Weekly Average
            </p>
            <div className="flex items-end gap-3">
              <p className="text-3xl font-semibold tabular-nums text-neutral-900 dark:text-white">
                {data.weeklyAverageRate}%
              </p>
              <div className="flex-1 h-1.5 bg-neutral-100 dark:bg-neutral-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 transition-all"
                  style={{ width: `${data.weeklyAverageRate}%` }}
                />
              </div>
            </div>
          </Card>
        </div>

        {/* Retention Metrics */}
        <div className="mb-8">
          <p className="text-xs font-medium uppercase tracking-wider text-neutral-400 mb-3">
            Retention
          </p>
          <Card padding="md">
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <p className="text-2xl font-semibold tabular-nums text-neutral-900 dark:text-white">
                  {data.retention.d1}%
                </p>
                <p className="text-xs text-neutral-500">Day 1</p>
              </div>
              <div className="text-center border-l border-neutral-100 dark:border-neutral-700/50">
                <p className="text-2xl font-semibold tabular-nums text-neutral-900 dark:text-white">
                  {data.retention.d3}%
                </p>
                <p className="text-xs text-neutral-500">Day 3</p>
              </div>
              <div className="text-center border-l border-neutral-100 dark:border-neutral-700/50">
                <p className="text-2xl font-semibold tabular-nums text-neutral-900 dark:text-white">
                  {data.retention.d7}%
                </p>
                <p className="text-xs text-neutral-500">Day 7</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Daily Stats Chart */}
        <div className="mb-8">
          <p className="text-xs font-medium uppercase tracking-wider text-neutral-400 mb-3">
            Last 7 Days
          </p>
          <Card padding="md">
            <div className="flex items-end gap-2 h-28">
              {data.dailyStats.map((day) => (
                <div
                  key={day.dateKey}
                  className="flex-1 flex flex-col items-center"
                >
                  <div
                    className="w-full bg-neutral-900 dark:bg-white rounded-sm transition-all"
                    style={{
                      height: `${day.submissionRate}%`,
                      minHeight: day.submissionRate > 0 ? "4px" : "0",
                    }}
                  />
                  <p className="text-[10px] text-neutral-400 mt-2">
                    {formatDate(day.dateKey).split(" ")[0]}
                  </p>
                  <p className="text-xs font-medium tabular-nums text-neutral-600 dark:text-neutral-400">
                    {day.submissionRate}%
                  </p>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Member List */}
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-neutral-400 mb-3">
            Members
          </p>
          <Card padding="sm">
            <div className="divide-y divide-neutral-50 dark:divide-neutral-800">
              {data.memberHealth.map((member) => (
                <div
                  key={member.userId}
                  className="px-2 py-3 flex items-center justify-between"
                >
                  <div>
                    <p className="font-medium text-sm text-neutral-900 dark:text-white">
                      {member.userName || member.userEmail.split("@")[0]}
                    </p>
                    <p className="text-xs text-neutral-400">
                      Last: {member.lastSubmissionDate || "Never"} · 7d:{" "}
                      {member.submissionsLast7Days} · 30d:{" "}
                      {member.submissionsLast30Days}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium tabular-nums text-neutral-500">
                      {member.currentStreak}
                    </span>
                    {getStatusBadge(member.status)}
                  </div>
                </div>
              ))}

              {data.memberHealth.length === 0 && (
                <div className="px-4 py-8 text-center text-neutral-400">
                  No members yet.
                </div>
              )}
            </div>
          </Card>
        </div>
      </PageContainer>
    </>
  );
}

export default function DashboardPage() {
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
      <DashboardContent />
    </Suspense>
  );
}
