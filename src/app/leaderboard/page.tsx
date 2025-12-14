"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Nav from "@/components/Nav";

type LeaderboardEntry = {
  userId: string;
  userName: string | null;
  userEmail: string;
  currentStreak: number;
  onTimeCount30Days: number;
  rank: number;
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
        <div className="max-w-2xl mx-auto p-4">
          <p className="text-gray-600 dark:text-gray-400">
            Please select a cohort first.
          </p>
        </div>
      </>
    );
  }

  if (loading) {
    return (
      <>
        <Nav />
        <div className="max-w-2xl mx-auto p-4">
          <p className="text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </>
    );
  }

  if (!data) {
    return (
      <>
        <Nav />
        <div className="max-w-2xl mx-auto p-4">
          <p className="text-gray-600 dark:text-gray-400">
            Failed to load leaderboard.
          </p>
        </div>
      </>
    );
  }

  const getRankDisplay = (rank: number) => {
    if (rank === 1) return { emoji: "1st", color: "text-yellow-500" };
    if (rank === 2) return { emoji: "2nd", color: "text-gray-400" };
    if (rank === 3) return { emoji: "3rd", color: "text-amber-600" };
    return { emoji: `${rank}th`, color: "text-gray-600 dark:text-gray-400" };
  };

  return (
    <>
      <Nav />
      <div className="max-w-2xl mx-auto p-4">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">
            Leaderboard
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {data.cohort.name}
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
            <div className="grid grid-cols-12 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
              <div className="col-span-1">#</div>
              <div className="col-span-7">Name</div>
              <div className="col-span-2 text-center">Streak</div>
              <div className="col-span-2 text-center">30d</div>
            </div>
          </div>

          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {data.leaderboard.map((entry) => {
              const isCurrentUser = entry.userId === data.currentUserId;
              const rankDisplay = getRankDisplay(entry.rank);

              return (
                <div
                  key={entry.userId}
                  className={`px-4 py-3 grid grid-cols-12 items-center ${
                    isCurrentUser
                      ? "bg-blue-50 dark:bg-blue-900/20"
                      : "hover:bg-gray-50 dark:hover:bg-gray-700/50"
                  }`}
                >
                  <div className={`col-span-1 font-medium ${rankDisplay.color}`}>
                    {rankDisplay.emoji}
                  </div>
                  <div className="col-span-7">
                    <p className={`font-medium ${
                      isCurrentUser
                        ? "text-blue-600 dark:text-blue-400"
                        : "text-gray-900 dark:text-white"
                    }`}>
                      {entry.userName || entry.userEmail.split("@")[0]}
                      {isCurrentUser && " (you)"}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {entry.userEmail}
                    </p>
                  </div>
                  <div className="col-span-2 text-center">
                    <span className="inline-flex items-center justify-center px-2 py-1 text-sm font-bold bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded">
                      {entry.currentStreak}
                    </span>
                  </div>
                  <div className="col-span-2 text-center text-sm text-gray-600 dark:text-gray-400">
                    {entry.onTimeCount30Days}
                  </div>
                </div>
              );
            })}

            {data.leaderboard.length === 0 && (
              <div className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                No members yet.
              </div>
            )}
          </div>
        </div>

        <p className="mt-4 text-xs text-gray-500 dark:text-gray-500 text-center">
          Ranked by: current streak, then on-time submissions (last 30 days), then earliest submission time
        </p>
      </div>
    </>
  );
}

export default function LeaderboardPage() {
  return (
    <Suspense fallback={<div className="p-4">Loading...</div>}>
      <LeaderboardContent />
    </Suspense>
  );
}
