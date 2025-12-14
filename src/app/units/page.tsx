"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Nav from "@/components/Nav";

type Unit = {
  id: string;
  name: string;
  orderIndex: number;
  levelScope: string;
};

type UserSubject = {
  id: string;
  subjectId: string;
  level: string;
  subject: {
    id: string;
    transcriptName: string;
    fullName: string;
    hasUnits: boolean;
    units: Unit[];
  };
};

type WeeklySelection = {
  subjectId: string;
  unitId: string;
  unit: Unit;
  subject: { transcriptName: string };
};

function UnitsContent() {
  const searchParams = useSearchParams();
  const cohortId = searchParams.get("cohortId");

  const [userSubjects, setUserSubjects] = useState<UserSubject[]>([]);
  const [weeklySelections, setWeeklySelections] = useState<WeeklySelection[]>([]);
  const [weekStartDateKey, setWeekStartDateKey] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState("");

  const fetchData = useCallback(async () => {
    try {
      const [subjectsRes, weeklyRes] = await Promise.all([
        fetch("/api/user-subjects"),
        fetch("/api/weekly-unit"),
      ]);

      const subjectsData = await subjectsRes.json();
      const weeklyData = await weeklyRes.json();

      if (subjectsRes.ok) {
        // Filter to only subjects with units
        const withUnits = subjectsData.userSubjects.filter(
          (us: UserSubject) => us.subject.hasUnits
        );
        setUserSubjects(withUnits);
      }

      if (weeklyRes.ok) {
        setWeeklySelections(weeklyData.selections || []);
        setWeekStartDateKey(weeklyData.weekStartDateKey);
      }
    } catch {
      console.error("Failed to fetch data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const selectUnit = async (subjectId: string, unitId: string) => {
    setError("");
    setSaving(subjectId);

    try {
      const res = await fetch("/api/weekly-unit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subjectId, unitId }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to save selection");
      } else {
        // Refresh selections
        const weeklyRes = await fetch("/api/weekly-unit");
        const weeklyData = await weeklyRes.json();
        if (weeklyRes.ok) {
          setWeeklySelections(weeklyData.selections || []);
        }
      }
    } catch {
      setError("Something went wrong");
    } finally {
      setSaving(null);
    }
  };

  const getSelectedUnit = (subjectId: string): string | null => {
    const selection = weeklySelections.find((s) => s.subjectId === subjectId);
    return selection?.unitId || null;
  };

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

  if (userSubjects.length === 0) {
    return (
      <>
        <Nav />
        <div className="max-w-2xl mx-auto p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 text-center">
            <p className="text-gray-600 dark:text-gray-400 mb-2">
              None of your subjects have predefined units.
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-500">
              Weekly unit selection is available for Math AA, Physics, and ESS.
            </p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Nav />
      <div className="max-w-2xl mx-auto p-4">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">
            Weekly Unit Focus
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Week of {weekStartDateKey}
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/30 rounded-lg">
            <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
          </div>
        )}

        <div className="space-y-6">
          {userSubjects.map((us) => {
            const selectedUnitId = getSelectedUnit(us.subjectId);
            const isSaving = saving === us.subjectId;

            return (
              <div
                key={us.id}
                className="bg-white dark:bg-gray-800 rounded-lg shadow p-4"
              >
                <h2 className="font-medium text-gray-900 dark:text-white mb-3">
                  {us.subject.fullName} ({us.level})
                </h2>
                <div className="space-y-2">
                  {us.subject.units
                    .filter(
                      (unit) =>
                        unit.levelScope === "BOTH" ||
                        (us.level === "HL" && unit.levelScope === "HL_ONLY") ||
                        (us.level === "SL" && unit.levelScope === "SL_ONLY")
                    )
                    .map((unit) => {
                      const isSelected = selectedUnitId === unit.id;

                      return (
                        <button
                          key={unit.id}
                          onClick={() => selectUnit(us.subjectId, unit.id)}
                          disabled={isSaving}
                          className={`w-full text-left p-3 rounded-lg border transition ${
                            isSelected
                              ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                              : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                          } ${isSaving ? "opacity-50" : ""}`}
                        >
                          <div className="flex items-center justify-between">
                            <span
                              className={`text-sm ${
                                isSelected
                                  ? "text-blue-700 dark:text-blue-300 font-medium"
                                  : "text-gray-700 dark:text-gray-300"
                              }`}
                            >
                              {unit.orderIndex}. {unit.name}
                            </span>
                            {isSelected && (
                              <span className="text-xs text-blue-600 dark:text-blue-400">
                                Selected
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                </div>
              </div>
            );
          })}
        </div>

        <p className="mt-6 text-xs text-gray-500 dark:text-gray-500 text-center">
          Your unit selection determines the focus of AI-generated practice questions.
          You can change your selection once per week.
        </p>
      </div>
    </>
  );
}

export default function UnitsPage() {
  return (
    <Suspense fallback={<div className="p-4">Loading...</div>}>
      <UnitsContent />
    </Suspense>
  );
}
