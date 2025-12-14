"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Nav from "@/components/Nav";

type CalendarDay = {
  dateKey: string;
  status: "on-time" | "late" | "missed";
};

type ProgressData = {
  streak: number;
  calendar: CalendarDay[];
  todayKey: string;
  cohort: { id: string; name: string };
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
            Failed to load progress.
          </p>
        </div>
      </>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "on-time":
        return "bg-green-500";
      case "late":
        return "bg-yellow-500";
      case "missed":
        return "bg-red-300 dark:bg-red-800";
      default:
        return "bg-gray-300";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "on-time":
        return "On-time";
      case "late":
        return "Late";
      case "missed":
        return "Missed";
      default:
        return status;
    }
  };

  // Group calendar by weeks for display
  const weeks: CalendarDay[][] = [];
  for (let i = 0; i < data.calendar.length; i += 7) {
    weeks.push(data.calendar.slice(i, i + 7));
  }

  return (
    <>
      <Nav />
      <div className="max-w-2xl mx-auto p-4">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">
            My Progress
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {data.cohort.name}
          </p>
        </div>

        <div className="mb-8 p-6 bg-white dark:bg-gray-800 rounded-lg shadow text-center">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
            Current Streak
          </p>
          <p className="text-5xl font-bold text-blue-600 dark:text-blue-400">
            {data.streak}
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            day{data.streak !== 1 ? "s" : ""}
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <h2 className="font-medium mb-4 text-gray-900 dark:text-white">
            Last 30 Days
          </h2>

          <div className="flex items-center gap-4 mb-4 text-sm">
            <div className="flex items-center gap-1">
              <div className="w-4 h-4 rounded bg-green-500"></div>
              <span className="text-gray-600 dark:text-gray-400">On-time</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-4 h-4 rounded bg-yellow-500"></div>
              <span className="text-gray-600 dark:text-gray-400">Late</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-4 h-4 rounded bg-red-300 dark:bg-red-800"></div>
              <span className="text-gray-600 dark:text-gray-400">Missed</span>
            </div>
          </div>

          <div className="space-y-1">
            {weeks.map((week, weekIdx) => (
              <div key={weekIdx} className="flex gap-1">
                {week.map((day) => (
                  <div
                    key={day.dateKey}
                    className={`flex-1 aspect-square rounded ${getStatusColor(day.status)} relative group`}
                    title={`${day.dateKey}: ${getStatusLabel(day.status)}`}
                  >
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition whitespace-nowrap pointer-events-none z-10">
                      {day.dateKey}: {getStatusLabel(day.status)}
                    </div>
                  </div>
                ))}
                {/* Fill remaining slots if week is incomplete */}
                {week.length < 7 &&
                  Array(7 - week.length)
                    .fill(null)
                    .map((_, i) => (
                      <div
                        key={`empty-${i}`}
                        className="flex-1 aspect-square"
                      ></div>
                    ))}
              </div>
            ))}
          </div>

          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <div className="grid grid-cols-3 gap-4 text-center text-sm">
              <div>
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {data.calendar.filter((d) => d.status === "on-time").length}
                </p>
                <p className="text-gray-600 dark:text-gray-400">On-time</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                  {data.calendar.filter((d) => d.status === "late").length}
                </p>
                <p className="text-gray-600 dark:text-gray-400">Late</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                  {data.calendar.filter((d) => d.status === "missed").length}
                </p>
                <p className="text-gray-600 dark:text-gray-400">Missed</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default function MePage() {
  return (
    <Suspense fallback={<div className="p-4">Loading...</div>}>
      <MeContent />
    </Suspense>
  );
}
