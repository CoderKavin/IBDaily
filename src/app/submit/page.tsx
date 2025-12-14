"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Nav from "@/components/Nav";

type Subject = {
  id: string;
  label: string;
  fullName: string;
  level: string;
  hasUnits: boolean;
};

type Submission = {
  id: string;
  subject: string;
  subjectId: string | null;
  bullet1: string;
  bullet2: string;
  bullet3: string;
  createdAt: string;
};

type DailyQuestion = {
  id: string;
  questionText: string;
  markingGuideText: string;
  commonMistakesText: string;
  difficultyRung: number;
  subject: { transcriptName: string };
  unit: { name: string } | null;
};

type CohortStatus = "TRIAL" | "ACTIVE" | "LOCKED";

function SubmitContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const cohortId = searchParams.get("cohortId");

  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [subjectId, setSubjectId] = useState("");
  const [bullet1, setBullet1] = useState("");
  const [bullet2, setBullet2] = useState("");
  const [bullet3, setBullet3] = useState("");
  const [existingSubmission, setExistingSubmission] =
    useState<Submission | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [timeRemaining, setTimeRemaining] = useState("");
  const [todayKey, setTodayKey] = useState("");
  const [needsOnboarding, setNeedsOnboarding] = useState(false);

  // Cohort status
  const [cohortStatus, setCohortStatus] = useState<CohortStatus>("TRIAL");
  const [canSubmit, setCanSubmit] = useState(true);
  const [lockReason, setLockReason] = useState<string | undefined>();

  // Daily question state
  const [dailyQuestions, setDailyQuestions] = useState<DailyQuestion[]>([]);
  const [aiEnabled, setAiEnabled] = useState(false);
  const [generatingQuestion, setGeneratingQuestion] = useState(false);
  const [selectedDifficulty, setSelectedDifficulty] = useState<1 | 2 | 3>(1);

  const fetchSubmission = useCallback(async () => {
    if (!cohortId) return;

    try {
      const res = await fetch(`/api/submission?cohortId=${cohortId}`);
      const data = await res.json();

      if (res.ok) {
        setSubjects(data.subjects || []);
        setTodayKey(data.todayKey);
        setNeedsOnboarding(data.needsOnboarding);
        setCohortStatus(data.cohortStatus || "TRIAL");
        setCanSubmit(data.canSubmit !== false);
        setLockReason(data.lockReason);

        if (data.submission) {
          setExistingSubmission(data.submission);
          setSubjectId(data.submission.subjectId || "");
          setBullet1(data.submission.bullet1);
          setBullet2(data.submission.bullet2);
          setBullet3(data.submission.bullet3);
        }
      }

      // Fetch daily questions
      const questionsRes = await fetch(
        `/api/daily-question?cohortId=${cohortId}`,
      );
      const questionsData = await questionsRes.json();
      if (questionsRes.ok) {
        setDailyQuestions(questionsData.questions || []);
        setAiEnabled(questionsData.aiEnabled);
      }
    } catch {
      console.error("Failed to fetch submission");
    } finally {
      setLoading(false);
    }
  }, [cohortId]);

  useEffect(() => {
    fetchSubmission();
  }, [fetchSubmission]);

  useEffect(() => {
    const updateTimer = () => {
      const now = new Date();
      const formatter = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Kolkata",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      });
      const todayIST = formatter.format(now);
      const cutoffISO = `${todayIST}T21:00:00+05:30`;
      const cutoff = new Date(cutoffISO);

      const diff = cutoff.getTime() - now.getTime();

      if (diff <= 0) {
        setTimeRemaining("Deadline passed");
      } else {
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);
        setTimeRemaining(
          `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`,
        );
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setSubmitting(true);

    try {
      const res = await fetch("/api/submission", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cohortId,
          subjectId,
          bullet1,
          bullet2,
          bullet3,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.cohortLocked) {
          setCanSubmit(false);
          setCohortStatus("LOCKED");
          setLockReason(data.error);
        }
        setError(data.error);
      } else {
        setSuccess(existingSubmission ? "Updated!" : "Submitted!");
        setExistingSubmission(data.submission);
      }
    } catch {
      setError("Failed to submit");
    } finally {
      setSubmitting(false);
    }
  };

  const generateQuestion = async () => {
    if (!subjectId) {
      setError("Please select a subject first");
      return;
    }

    setGeneratingQuestion(true);
    setError("");

    try {
      const res = await fetch("/api/daily-question", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cohortId,
          subjectId,
          difficultyRung: selectedDifficulty,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.needsUnitSelection) {
          setError(
            "Please select a weekly unit for this subject first. Go to Units page.",
          );
        } else {
          setError(data.error);
        }
      } else {
        // Refresh questions
        const questionsRes = await fetch(
          `/api/daily-question?cohortId=${cohortId}`,
        );
        const questionsData = await questionsRes.json();
        if (questionsRes.ok) {
          setDailyQuestions(questionsData.questions || []);
        }
      }
    } catch {
      setError("Failed to generate question");
    } finally {
      setGeneratingQuestion(false);
    }
  };

  const getDifficultyLabel = (rung: number) => {
    switch (rung) {
      case 1:
        return "Recall";
      case 2:
        return "Application";
      case 3:
        return "Exam-style";
      default:
        return "Unknown";
    }
  };

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

  if (needsOnboarding) {
    return (
      <>
        <Nav />
        <div className="max-w-2xl mx-auto p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 text-center">
            <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              Set Up Your Subjects
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Before you can submit, please select your IB subjects.
            </p>
            <button
              onClick={() => router.push("/onboarding")}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md"
            >
              Select Subjects
            </button>
          </div>
        </div>
      </>
    );
  }

  // Show locked message if cohort is locked
  if (!canSubmit && cohortStatus === "LOCKED") {
    return (
      <>
        <Nav />
        <div className="max-w-2xl mx-auto p-4">
          <div className="mb-6">
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">
              Daily Submission
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {todayKey}
            </p>
          </div>

          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0">
                <svg
                  className="h-6 w-6 text-red-600 dark:text-red-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth="1.5"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
                  />
                </svg>
              </div>
              <div className="flex-1">
                <h2 className="text-lg font-medium text-red-800 dark:text-red-200 mb-2">
                  Submissions Paused
                </h2>
                <p className="text-red-700 dark:text-red-300 mb-4">
                  {lockReason ||
                    "The trial period has ended. Activate your membership to continue submitting."}
                </p>
                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={() => router.push("/billing")}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md"
                  >
                    Activate Membership
                  </button>
                  <button
                    onClick={() => router.push("/me")}
                    className="px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-white font-medium rounded-md"
                  >
                    View History
                  </button>
                  <button
                    onClick={() => router.push("/leaderboard")}
                    className="px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-white font-medium rounded-md"
                  >
                    View Leaderboard
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Show existing submission if any */}
          {existingSubmission && (
            <div className="mt-6 bg-white dark:bg-gray-800 rounded-lg shadow p-4">
              <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
                Today&apos;s Submission
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                {existingSubmission.subject}
              </p>
              <ul className="text-sm text-gray-700 dark:text-gray-300 space-y-1">
                <li>• {existingSubmission.bullet1}</li>
                <li>• {existingSubmission.bullet2}</li>
                <li>• {existingSubmission.bullet3}</li>
              </ul>
            </div>
          )}
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
            Daily Submission
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">{todayKey}</p>
        </div>

        {/* Trial status banner */}
        {cohortStatus === "TRIAL" && (
          <div className="mb-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
            <p className="text-sm text-yellow-700 dark:text-yellow-300">
              Your cohort is in trial mode. Submissions are enabled.
            </p>
          </div>
        )}

        <div
          className={`mb-6 p-4 rounded-lg ${
            timeRemaining === "Deadline passed"
              ? "bg-red-100 dark:bg-red-900/30"
              : "bg-blue-100 dark:bg-blue-900/30"
          }`}
        >
          <p className="text-sm text-gray-700 dark:text-gray-300">
            Time until 9:00 PM IST deadline:
          </p>
          <p
            className={`text-2xl font-mono font-bold ${
              timeRemaining === "Deadline passed"
                ? "text-red-600 dark:text-red-400"
                : "text-blue-600 dark:text-blue-400"
            }`}
          >
            {timeRemaining}
          </p>
        </div>

        {existingSubmission && (
          <div className="mb-4 p-3 bg-green-100 dark:bg-green-900/30 rounded-lg">
            <p className="text-sm text-green-700 dark:text-green-400">
              You&apos;ve already submitted today. You can update your
              submission below.
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Subject
            </label>
            <select
              value={subjectId}
              onChange={(e) => setSubjectId(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="">Select a subject</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Bullet 1{" "}
              <span className="text-gray-500">({bullet1.length}/140)</span>
            </label>
            <input
              type="text"
              value={bullet1}
              onChange={(e) => setBullet1(e.target.value.slice(0, 140))}
              required
              maxLength={140}
              placeholder="First key concept..."
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Bullet 2{" "}
              <span className="text-gray-500">({bullet2.length}/140)</span>
            </label>
            <input
              type="text"
              value={bullet2}
              onChange={(e) => setBullet2(e.target.value.slice(0, 140))}
              required
              maxLength={140}
              placeholder="Second key concept..."
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Bullet 3{" "}
              <span className="text-gray-500">({bullet3.length}/140)</span>
            </label>
            <input
              type="text"
              value={bullet3}
              onChange={(e) => setBullet3(e.target.value.slice(0, 140))}
              required
              maxLength={140}
              placeholder="Third key concept..."
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>

          {error && <p className="text-red-500 text-sm">{error}</p>}
          {success && <p className="text-green-500 text-sm">{success}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium rounded-md transition"
          >
            {submitting
              ? "..."
              : existingSubmission
                ? "Update Submission"
                : "Submit"}
          </button>
        </form>

        {/* Daily Question Section */}
        {existingSubmission && (
          <div className="mt-8 space-y-4">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">
              Today&apos;s Practice Question
            </h2>

            {!aiEnabled && (
              <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded-lg">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  AI question generation is not configured. Set GEMINI_API_KEY,
                  OPENAI_API_KEY, or ANTHROPIC_API_KEY in .env to enable.
                </p>
              </div>
            )}

            {aiEnabled && dailyQuestions.length === 0 && (
              <div className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  Generate a practice question based on your selected subject
                  and weekly unit focus.
                </p>
                <div className="flex items-center gap-3 mb-4">
                  <label className="text-sm text-gray-700 dark:text-gray-300">
                    Difficulty:
                  </label>
                  <select
                    value={selectedDifficulty}
                    onChange={(e) =>
                      setSelectedDifficulty(Number(e.target.value) as 1 | 2 | 3)
                    }
                    className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                  >
                    <option value={1}>Recall</option>
                    <option value={2}>Application</option>
                    <option value={3}>Exam-style</option>
                  </select>
                </div>
                <button
                  onClick={generateQuestion}
                  disabled={generatingQuestion || !subjectId}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 text-white font-medium rounded-md transition"
                >
                  {generatingQuestion ? "Generating..." : "Generate Question"}
                </button>
              </div>
            )}

            {dailyQuestions.map((question) => (
              <div
                key={question.id}
                className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden"
              >
                <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {question.subject.transcriptName}
                      {question.unit && ` - ${question.unit.name}`}
                    </span>
                    <span className="text-xs px-2 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded">
                      {getDifficultyLabel(question.difficultyRung)}
                    </span>
                  </div>
                  <p className="text-gray-800 dark:text-gray-200">
                    {question.questionText}
                  </p>
                </div>

                <details className="group">
                  <summary className="px-4 py-3 cursor-pointer text-sm font-medium text-blue-600 dark:text-blue-400 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    Show Marking Guide & Common Mistakes
                  </summary>
                  <div className="px-4 pb-4 space-y-3">
                    <div>
                      <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-1">
                        Marking Guide (Suggestions)
                      </h4>
                      <p className="text-sm text-gray-700 dark:text-gray-300">
                        {question.markingGuideText}
                      </p>
                    </div>
                    <div>
                      <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-1">
                        Common Mistakes to Watch For
                      </h4>
                      <p className="text-sm text-gray-700 dark:text-gray-300">
                        {question.commonMistakesText}
                      </p>
                    </div>
                  </div>
                </details>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

export default function SubmitPage() {
  return (
    <Suspense fallback={<div className="p-4">Loading...</div>}>
      <SubmitContent />
    </Suspense>
  );
}
