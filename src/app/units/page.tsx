"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Nav from "@/components/Nav";
import { PageContainer, Card } from "@/components/ui";

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
  // cohortId available for future use
  searchParams.get("cohortId");

  const [userSubjects, setUserSubjects] = useState<UserSubject[]>([]);
  const [weeklySelections, setWeeklySelections] = useState<WeeklySelection[]>(
    [],
  );
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
        const withUnits = subjectsData.userSubjects.filter(
          (us: UserSubject) => us.subject.hasUnits,
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
        <PageContainer>
          <div className="flex items-center justify-center py-16">
            <div className="w-5 h-5 border-2 border-neutral-300 border-t-neutral-600 rounded-full animate-spin" />
          </div>
        </PageContainer>
      </>
    );
  }

  if (userSubjects.length === 0) {
    return (
      <>
        <Nav />
        <PageContainer>
          <Card>
            <div className="text-center py-4">
              <p className="text-neutral-500 mb-2">
                None of your subjects have predefined units.
              </p>
              <p className="text-sm text-neutral-400">
                Weekly unit selection is available for Math AA, Physics, and
                ESS.
              </p>
            </div>
          </Card>
        </PageContainer>
      </>
    );
  }

  return (
    <>
      <Nav />
      <PageContainer>
        {/* Header */}
        <div className="mb-8">
          <p className="text-xs font-medium uppercase tracking-wider text-neutral-400 mb-1">
            Week of {weekStartDateKey}
          </p>
          <h1 className="text-2xl font-semibold text-neutral-900 dark:text-white">
            Weekly Unit Focus
          </h1>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 rounded-lg">
            <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
          </div>
        )}

        {/* Subject units */}
        <div className="space-y-6">
          {userSubjects.map((us) => {
            const selectedUnitId = getSelectedUnit(us.subjectId);
            const isSaving = saving === us.subjectId;

            return (
              <div key={us.id}>
                <h2 className="text-xs font-medium uppercase tracking-wider text-neutral-400 mb-3">
                  {us.subject.fullName} ({us.level})
                </h2>
                <Card padding="sm">
                  <div className="divide-y divide-neutral-50 dark:divide-neutral-800">
                    {us.subject.units
                      .filter(
                        (unit) =>
                          unit.levelScope === "BOTH" ||
                          (us.level === "HL" &&
                            unit.levelScope === "HL_ONLY") ||
                          (us.level === "SL" && unit.levelScope === "SL_ONLY"),
                      )
                      .map((unit) => {
                        const isSelected = selectedUnitId === unit.id;

                        return (
                          <button
                            key={unit.id}
                            onClick={() => selectUnit(us.subjectId, unit.id)}
                            disabled={isSaving}
                            className={`
                              w-full text-left py-3 px-2 -mx-2 rounded-lg transition-all
                              ${
                                isSelected
                                  ? "bg-neutral-100 dark:bg-neutral-700/50"
                                  : "hover:bg-neutral-50 dark:hover:bg-neutral-800/50"
                              }
                              ${isSaving ? "opacity-50" : ""}
                            `}
                          >
                            <div className="flex items-center justify-between">
                              <span
                                className={`
                                  text-sm
                                  ${
                                    isSelected
                                      ? "text-neutral-900 dark:text-white font-medium"
                                      : "text-neutral-600 dark:text-neutral-400"
                                  }
                                `}
                              >
                                <span className="text-neutral-400 mr-1.5">
                                  {unit.orderIndex}.
                                </span>
                                {unit.name}
                              </span>
                              {isSelected && (
                                <span className="text-xs text-neutral-500">
                                  Selected
                                </span>
                              )}
                            </div>
                          </button>
                        );
                      })}
                  </div>
                </Card>
              </div>
            );
          })}
        </div>

        {/* Note */}
        <p className="mt-6 text-xs text-neutral-400 text-center">
          Your unit selection determines the focus of AI-generated practice
          questions.
        </p>
      </PageContainer>
    </>
  );
}

export default function UnitsPage() {
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
      <UnitsContent />
    </Suspense>
  );
}
