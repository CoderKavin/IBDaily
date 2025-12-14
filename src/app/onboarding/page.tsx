"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import OnboardingProgress from "@/components/OnboardingProgress";
import { PageContainer, Card, PrimaryButton } from "@/components/ui";
import { apiGet, apiPost, getErrorMessage } from "@/lib/api-client";

const ONBOARDING_STEPS = [
  { label: "Subjects", description: "Select your IB subjects" },
  { label: "Cohort", description: "Join or create a study group" },
  { label: "Units", description: "Choose weekly focus units" },
];

type Subject = {
  id: string;
  subjectCode: string;
  transcriptName: string;
  fullName: string;
  groupName: string;
  groupNumber: number;
  slAvailable: boolean;
  hlAvailable: boolean;
};

type Selection = {
  subjectId: string;
  level: "SL" | "HL";
};

export default function OnboardingPage() {
  const router = useRouter();
  const [grouped, setGrouped] = useState<Record<string, Subject[]>>({});
  const [selections, setSelections] = useState<Selection[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
    new Set(["Core: Extended Essay", "Core: Theory of Knowledge"]),
  );

  useEffect(() => {
    fetchSubjects();
  }, []);

  const fetchSubjects = async () => {
    setError("");
    try {
      const data = await apiGet<{ grouped: Record<string, Subject[]> }>(
        "/api/subjects",
      );
      setGrouped(data.grouped);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const toggleSubject = (subjectId: string, level: "SL" | "HL") => {
    setSelections((prev) => {
      const existing = prev.find((s) => s.subjectId === subjectId);
      if (existing) {
        if (existing.level === level) {
          return prev.filter((s) => s.subjectId !== subjectId);
        } else {
          return prev.map((s) =>
            s.subjectId === subjectId ? { ...s, level } : s,
          );
        }
      } else {
        return [...prev, { subjectId, level }];
      }
    });
  };

  const getSelection = (subjectId: string): Selection | undefined => {
    return selections.find((s) => s.subjectId === subjectId);
  };

  const toggleGroup = (groupName: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupName)) {
        next.delete(groupName);
      } else {
        next.add(groupName);
      }
      return next;
    });
  };

  const handleSubmit = async () => {
    if (selections.length === 0) {
      setError("Please select at least one subject");
      return;
    }

    if (submitting) return; // Prevent double submit

    setError("");
    setSubmitting(true);

    try {
      await apiPost("/api/user-subjects", { selections });
      router.push("/cohort?onboarding=true");
      router.refresh();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  // Filter subjects based on search
  const filteredGrouped = useMemo(() => {
    if (!search.trim()) return grouped;

    const searchLower = search.toLowerCase();
    const result: Record<string, Subject[]> = {};

    for (const [groupName, subjects] of Object.entries(grouped)) {
      const filtered = subjects.filter(
        (s) =>
          s.fullName.toLowerCase().includes(searchLower) ||
          s.transcriptName.toLowerCase().includes(searchLower),
      );
      if (filtered.length > 0) {
        result[groupName] = filtered;
      }
    }

    return result;
  }, [grouped, search]);

  // When searching, expand all groups that have matches
  const effectiveExpandedGroups = useMemo(() => {
    if (search.trim()) {
      return new Set(Object.keys(filteredGrouped));
    }
    return expandedGroups;
  }, [search, filteredGrouped, expandedGroups]);

  if (loading) {
    return (
      <PageContainer>
        <div className="flex items-center justify-center py-16">
          <div className="w-5 h-5 border-2 border-neutral-300 border-t-neutral-600 rounded-full animate-spin" />
        </div>
      </PageContainer>
    );
  }

  // Show error state if loading failed
  if (error && Object.keys(grouped).length === 0) {
    return (
      <PageContainer>
        <div className="text-center py-16">
          <p className="text-red-600 dark:text-red-400 mb-4">{error}</p>
          <PrimaryButton onClick={fetchSubjects}>Try Again</PrimaryButton>
        </div>
      </PageContainer>
    );
  }

  const groupOrder = Object.keys(filteredGrouped).sort((a, b) => {
    const aNum = filteredGrouped[a][0]?.groupNumber ?? 99;
    const bNum = filteredGrouped[b][0]?.groupNumber ?? 99;
    return aNum - bNum;
  });

  const selectedSubjectIds = new Set(selections.map((s) => s.subjectId));

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900 pb-24">
      <PageContainer>
        <OnboardingProgress
          currentStep={1}
          totalSteps={3}
          steps={ONBOARDING_STEPS}
        />

        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-neutral-900 dark:text-white">
            Select Your Subjects
          </h1>
          <p className="mt-1 text-sm text-neutral-500">
            Choose your IB subjects and indicate SL or HL for each.
          </p>
        </div>

        {/* Search */}
        <div className="mb-6">
          <div className="relative">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search subjects (e.g., Spanish, Physics, Economics)"
              className="w-full pl-10 pr-4 py-2.5 text-sm border border-neutral-200 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900 dark:focus:ring-white"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            )}
          </div>
          {search && (
            <p className="mt-2 text-xs text-neutral-500">
              {Object.values(filteredGrouped).flat().length} subjects found
            </p>
          )}
        </div>

        {/* Subject groups */}
        <div className="space-y-3">
          {groupOrder.map((groupName) => {
            const subjects = filteredGrouped[groupName];
            const isExpanded = effectiveExpandedGroups.has(groupName);
            const selectedInGroup = subjects.filter((s) =>
              selectedSubjectIds.has(s.id),
            ).length;

            return (
              <div key={groupName}>
                <button
                  type="button"
                  onClick={() => toggleGroup(groupName)}
                  className="w-full flex items-center justify-between py-2 text-left group"
                >
                  <div className="flex items-center gap-2">
                    <svg
                      className={`w-4 h-4 text-neutral-400 transition-transform ${isExpanded ? "rotate-90" : ""}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                    <span className="text-xs font-medium uppercase tracking-wider text-neutral-500 group-hover:text-neutral-700 dark:group-hover:text-neutral-300">
                      {groupName}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {selectedInGroup > 0 && (
                      <span className="text-xs bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 px-2 py-0.5 rounded-full">
                        {selectedInGroup}
                      </span>
                    )}
                    <span className="text-xs text-neutral-400">
                      {subjects.length}
                    </span>
                  </div>
                </button>

                {isExpanded && (
                  <Card padding="sm">
                    <div className="divide-y divide-neutral-100 dark:divide-neutral-700/50">
                      {subjects.map((subject) => {
                        const selection = getSelection(subject.id);
                        const isSelected = !!selection;

                        return (
                          <div
                            key={subject.id}
                            className={`
                              py-3 px-1 flex items-center justify-between
                              ${isSelected ? "bg-neutral-50 dark:bg-neutral-800/50 -mx-1 px-2 rounded-lg" : ""}
                            `}
                          >
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
                              {subject.fullName}
                            </span>
                            <div className="flex gap-1.5">
                              {subject.slAvailable && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    toggleSubject(subject.id, "SL")
                                  }
                                  className={`
                                    px-3 py-1 text-xs font-medium rounded-md transition-all
                                    ${
                                      selection?.level === "SL"
                                        ? "bg-neutral-900 dark:bg-white text-white dark:text-neutral-900"
                                        : "bg-neutral-100 dark:bg-neutral-800 text-neutral-500 hover:bg-neutral-200 dark:hover:bg-neutral-700"
                                    }
                                  `}
                                >
                                  SL
                                </button>
                              )}
                              {subject.hlAvailable && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    toggleSubject(subject.id, "HL")
                                  }
                                  className={`
                                    px-3 py-1 text-xs font-medium rounded-md transition-all
                                    ${
                                      selection?.level === "HL"
                                        ? "bg-neutral-900 dark:bg-white text-white dark:text-neutral-900"
                                        : "bg-neutral-100 dark:bg-neutral-800 text-neutral-500 hover:bg-neutral-200 dark:hover:bg-neutral-700"
                                    }
                                  `}
                                >
                                  HL
                                </button>
                              )}
                              {!subject.slAvailable && !subject.hlAvailable && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    toggleSubject(subject.id, "SL")
                                  }
                                  className={`
                                    px-3 py-1 text-xs font-medium rounded-md transition-all
                                    ${
                                      isSelected
                                        ? "bg-neutral-900 dark:bg-white text-white dark:text-neutral-900"
                                        : "bg-neutral-100 dark:bg-neutral-800 text-neutral-500 hover:bg-neutral-200 dark:hover:bg-neutral-700"
                                    }
                                  `}
                                >
                                  Core
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </Card>
                )}
              </div>
            );
          })}
        </div>

        {groupOrder.length === 0 && search && (
          <div className="text-center py-8">
            <p className="text-sm text-neutral-500">
              No subjects found for &quot;{search}&quot;
            </p>
          </div>
        )}

        {error && (
          <p className="mt-4 text-sm text-red-600 dark:text-red-400 text-center">
            {error}
          </p>
        )}
      </PageContainer>

      {/* Fixed bottom bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-neutral-800 border-t border-neutral-200 dark:border-neutral-700">
        <div className="max-w-xl mx-auto px-4 py-4 flex items-center justify-between">
          <span className="text-sm text-neutral-500">
            {selections.length} subject{selections.length !== 1 ? "s" : ""}{" "}
            selected
          </span>
          <PrimaryButton
            onClick={handleSubmit}
            disabled={selections.length === 0 || submitting}
            loading={submitting}
          >
            Continue
          </PrimaryButton>
        </div>
      </div>
    </div>
  );
}
