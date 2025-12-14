"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

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

  useEffect(() => {
    fetchSubjects();
  }, []);

  const fetchSubjects = async () => {
    try {
      const res = await fetch("/api/subjects");
      const data = await res.json();
      if (res.ok) {
        setGrouped(data.grouped);
      }
    } catch {
      console.error("Failed to fetch subjects");
    } finally {
      setLoading(false);
    }
  };

  const toggleSubject = (subjectId: string, level: "SL" | "HL") => {
    setSelections((prev) => {
      const existing = prev.find((s) => s.subjectId === subjectId);
      if (existing) {
        if (existing.level === level) {
          // Deselect
          return prev.filter((s) => s.subjectId !== subjectId);
        } else {
          // Change level
          return prev.map((s) =>
            s.subjectId === subjectId ? { ...s, level } : s
          );
        }
      } else {
        // Add new selection
        return [...prev, { subjectId, level }];
      }
    });
  };

  const getSelection = (subjectId: string): Selection | undefined => {
    return selections.find((s) => s.subjectId === subjectId);
  };

  const handleSubmit = async () => {
    if (selections.length === 0) {
      setError("Please select at least one subject");
      return;
    }

    setError("");
    setSubmitting(true);

    try {
      const res = await fetch("/api/user-subjects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ selections }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to save subjects");
      } else {
        router.push("/cohort");
        router.refresh();
      }
    } catch {
      setError("Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-600 dark:text-gray-400">Loading subjects...</p>
      </div>
    );
  }

  const groupOrder = Object.keys(grouped).sort((a, b) => {
    const aNum = grouped[a][0]?.groupNumber ?? 99;
    const bNum = grouped[b][0]?.groupNumber ?? 99;
    return aNum - bNum;
  });

  return (
    <div className="min-h-screen p-4 pb-20">
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Select Your IB Subjects
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Choose your subjects and indicate SL or HL for each.
          </p>
        </div>

        <div className="space-y-6">
          {groupOrder.map((groupName) => (
            <div
              key={groupName}
              className="bg-white dark:bg-gray-800 rounded-lg shadow p-4"
            >
              <h2 className="font-medium text-gray-900 dark:text-white mb-3 text-sm">
                {groupName}
              </h2>
              <div className="space-y-2">
                {grouped[groupName].map((subject) => {
                  const selection = getSelection(subject.id);
                  const isSelected = !!selection;

                  return (
                    <div
                      key={subject.id}
                      className={`p-3 rounded-lg border ${
                        isSelected
                          ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                          : "border-gray-200 dark:border-gray-700"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span
                          className={`text-sm ${
                            isSelected
                              ? "text-blue-700 dark:text-blue-300 font-medium"
                              : "text-gray-700 dark:text-gray-300"
                          }`}
                        >
                          {subject.fullName}
                        </span>
                        <div className="flex gap-2">
                          {subject.slAvailable && (
                            <button
                              type="button"
                              onClick={() => toggleSubject(subject.id, "SL")}
                              className={`px-3 py-1 text-xs font-medium rounded ${
                                selection?.level === "SL"
                                  ? "bg-blue-600 text-white"
                                  : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                              }`}
                            >
                              SL
                            </button>
                          )}
                          {subject.hlAvailable && (
                            <button
                              type="button"
                              onClick={() => toggleSubject(subject.id, "HL")}
                              className={`px-3 py-1 text-xs font-medium rounded ${
                                selection?.level === "HL"
                                  ? "bg-blue-600 text-white"
                                  : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                              }`}
                            >
                              HL
                            </button>
                          )}
                          {!subject.slAvailable && !subject.hlAvailable && (
                            <button
                              type="button"
                              onClick={() => toggleSubject(subject.id, "SL")}
                              className={`px-3 py-1 text-xs font-medium rounded ${
                                isSelected
                                  ? "bg-blue-600 text-white"
                                  : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                              }`}
                            >
                              Core
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {error && (
          <p className="mt-4 text-red-500 text-sm text-center">{error}</p>
        )}

        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
          <div className="max-w-2xl mx-auto flex items-center justify-between">
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {selections.length} subject{selections.length !== 1 ? "s" : ""} selected
            </span>
            <button
              onClick={handleSubmit}
              disabled={submitting || selections.length === 0}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium rounded-md transition"
            >
              {submitting ? "Saving..." : "Continue"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
