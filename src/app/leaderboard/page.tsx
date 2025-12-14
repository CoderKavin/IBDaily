"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Nav from "@/components/Nav";
import { PageContainer, Card } from "@/components/ui";

type LeaderboardTier = "TOP" | "MIDDLE" | "CATCHING_UP";

type LeaderboardEntry = {
  userId: string;
  userName: string | null;
  userEmail: string;
  currentStreak: number;
  onTimeCount30Days: number;
  rank: number;
  tier: LeaderboardTier;
};

type LeaderboardData = {
  leaderboard: LeaderboardEntry[];
  cohort: { id: string; name: string };
  currentUserId: string;
};

function LeaderboardContent() {
  const searchParams = useSearchParams();
  const cohortId = searchParams.get("cohortId");
  const [data, setData] = useState<LeaderboardData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchLeaderboard = useCallback(async () => {
    if (!cohortId) return;

    try {
      const res = await fetch(`/api/leaderboard?cohortId=${cohortId}`);
      const result = await res.json();
      if (res.ok) {
        setData(result);
      }
    } catch {
      console.error("Failed to fetch leaderboard");
    } finally {
      setLoading(false);
    }
  }, [cohortId]);

  useEffect(() => {
    fetchLeaderboard();
  }, [fetchLeaderboard]);

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
          <p className="text-neutral-500">Failed to load leaderboard.</p>
        </PageContainer>
      </>
    );
  }

  const getTierLabel = (tier: LeaderboardTier) => {
    switch (tier) {
      case "TOP":
        return "Top 20%";
      case "MIDDLE":
        return "Middle";
      case "CATCHING_UP":
        return "Rising";
    }
  };

  // Find current user's data
  const currentUserEntry = data.leaderboard.find(
    (e) => e.userId === data.currentUserId,
  );

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
            Leaderboard
          </h1>
        </div>

        {/* Current user's position - quick glance */}
        {currentUserEntry && (
          <div className="mb-6 flex items-center justify-between py-3 px-4 bg-neutral-100 dark:bg-neutral-800 rounded-lg">
            <div className="flex items-center gap-3">
              <span className="text-2xl font-semibold tabular-nums text-neutral-900 dark:text-white">
                #{currentUserEntry.rank}
              </span>
              <span className="text-sm text-neutral-500">Your position</span>
            </div>
            <div className="flex items-center gap-4 text-sm">
              <div className="text-center">
                <span className="font-semibold tabular-nums text-neutral-900 dark:text-white">
                  {currentUserEntry.currentStreak}
                </span>
                <span className="ml-1 text-neutral-400">streak</span>
              </div>
              <div className="text-center">
                <span className="font-semibold tabular-nums text-neutral-900 dark:text-white">
                  {currentUserEntry.onTimeCount30Days}
                </span>
                <span className="ml-1 text-neutral-400">/ 30 days</span>
              </div>
            </div>
          </div>
        )}

        {/* Leaderboard table */}
        <Card padding="sm">
          {/* Header row */}
          <div className="px-4 py-2 border-b border-neutral-100 dark:border-neutral-700/50">
            <div className="grid grid-cols-12 text-xs font-medium text-neutral-400 uppercase tracking-wide">
              <div className="col-span-1">#</div>
              <div className="col-span-6">Name</div>
              <div className="col-span-2 text-right">Streak</div>
              <div className="col-span-3 text-right">30 days</div>
            </div>
          </div>

          {/* Entries */}
          <div className="divide-y divide-neutral-50 dark:divide-neutral-800">
            {data.leaderboard.map((entry) => {
              const isCurrentUser = entry.userId === data.currentUserId;

              return (
                <div
                  key={entry.userId}
                  className={`
                    px-4 py-3 grid grid-cols-12 items-center
                    ${
                      isCurrentUser
                        ? "bg-neutral-50 dark:bg-neutral-700/30"
                        : ""
                    }
                  `}
                >
                  {/* Rank */}
                  <div className="col-span-1">
                    <span
                      className={`
                        font-semibold tabular-nums
                        ${
                          entry.rank <= 3
                            ? "text-neutral-900 dark:text-white"
                            : "text-neutral-400"
                        }
                      `}
                    >
                      {entry.rank}
                    </span>
                  </div>

                  {/* Name & tier */}
                  <div className="col-span-6">
                    <div className="flex items-center gap-2">
                      <span
                        className={`
                          font-medium
                          ${
                            isCurrentUser
                              ? "text-neutral-900 dark:text-white"
                              : "text-neutral-700 dark:text-neutral-300"
                          }
                        `}
                      >
                        {entry.userName || entry.userEmail.split("@")[0]}
                        {isCurrentUser && (
                          <span className="ml-1.5 text-xs font-normal text-neutral-400">
                            you
                          </span>
                        )}
                      </span>
                      {entry.tier === "TOP" && (
                        <span className="px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-neutral-400 bg-neutral-100 dark:bg-neutral-700 rounded">
                          {getTierLabel(entry.tier)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Streak */}
                  <div className="col-span-2 text-right">
                    <span
                      className={`
                        font-semibold tabular-nums
                        ${
                          entry.currentStreak > 0
                            ? "text-neutral-900 dark:text-white"
                            : "text-neutral-300 dark:text-neutral-600"
                        }
                      `}
                    >
                      {entry.currentStreak}
                    </span>
                  </div>

                  {/* 30-day count */}
                  <div className="col-span-3 text-right">
                    <span className="tabular-nums text-neutral-500">
                      {entry.onTimeCount30Days}
                    </span>
                  </div>
                </div>
              );
            })}

            {data.leaderboard.length === 0 && (
              <div className="px-4 py-12 text-center text-neutral-400">
                No members yet.
              </div>
            )}
          </div>
        </Card>

        {/* Ranking criteria - subtle */}
        <p className="mt-4 text-xs text-neutral-400 text-center">
          Ranked by streak, then on-time submissions (30 days), then earliest
          submission
        </p>
      </PageContainer>
    </>
  );
}

export default function LeaderboardPage() {
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
      <LeaderboardContent />
    </Suspense>
  );
}
