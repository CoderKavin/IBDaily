"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Nav from "@/components/Nav";
import {
  PageContainer,
  Card,
  PrimaryButton,
  WarningBanner,
} from "@/components/ui";
import { apiGet, apiPost, getErrorMessage } from "@/lib/api-client";

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

type CohortStatus = "TRIAL" | "ACTIVE" | "LOCKED";

type SubmissionResponse = {
  submission: Submission | null;
  subjects: Subject[];
  todayKey: string;
  needsOnboarding: boolean;
  cohortStatus: CohortStatus;
  canSubmit: boolean;
  lockReason?: string;
};

type MeResponse = {
  streak: number;
  calendar: unknown[];
  todaySubmission: Submission | null;
};

type LeaderboardEntry = {
  userId: string;
  rank: number;
};

type LeaderboardResponse = {
  leaderboard: LeaderboardEntry[];
  currentUserId: string;
};

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
  const [loadError, setLoadError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [timeRemaining, setTimeRemaining] = useState("");
  const [minutesLeft, setMinutesLeft] = useState<number | null>(null);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [cohortStatus, setCohortStatus] = useState<CohortStatus>("TRIAL");
  const [canSubmit, setCanSubmit] = useState(true);
  const [lockReason, setLockReason] = useState<string | undefined>();

  // Fetch current streak and rank
  const [streak, setStreak] = useState<number>(0);
  const [rank, setRank] = useState<number | null>(null);

  const fetchSubmission = useCallback(async () => {
    if (!cohortId) return;

    setLoadError("");
    try {
      const [subData, meData] = await Promise.all([
        apiGet<SubmissionResponse>("/api/submission", { cohortId }),
        apiGet<MeResponse>("/api/me", { cohortId }),
      ]);

      setSubjects(subData.subjects || []);
      setNeedsOnboarding(subData.needsOnboarding);
      setCohortStatus(subData.cohortStatus || "TRIAL");
      setCanSubmit(subData.canSubmit !== false);
      setLockReason(subData.lockReason);

      if (subData.submission) {
        setExistingSubmission(subData.submission);
        setSubjectId(subData.submission.subjectId || "");
        setBullet1(subData.submission.bullet1);
        setBullet2(subData.submission.bullet2);
        setBullet3(subData.submission.bullet3);
      }

      setStreak(meData.streak || 0);

      // Fetch rank from leaderboard
      try {
        const lbData = await apiGet<LeaderboardResponse>("/api/leaderboard", {
          cohortId,
        });
        const myEntry = lbData.leaderboard?.find(
          (e) => e.userId === lbData.currentUserId,
        );
        if (myEntry) {
          setRank(myEntry.rank);
        }
      } catch {
        // Leaderboard is non-critical, ignore errors
      }
    } catch (err) {
      setLoadError(getErrorMessage(err));
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
        setMinutesLeft(null);
      } else {
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const totalMinutes = Math.floor(diff / (1000 * 60));
        setMinutesLeft(totalMinutes);

        if (hours > 0) {
          setTimeRemaining(`${hours}h ${minutes}m`);
        } else {
          setTimeRemaining(`${minutes}m`);
        }
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (submitting) return; // Prevent double submit

    setError("");
    setSuccess("");
    setSubmitting(true);

    try {
      const data = await apiPost<{
        submission: Submission;
        qualityStatus: string;
      }>("/api/submission", {
        cohortId,
        subjectId,
        bullet1,
        bullet2,
        bullet3,
      });

      setSuccess("Saved");
      setExistingSubmission(data.submission);

      // Refresh streak
      try {
        const meData = await apiGet<MeResponse>("/api/me", {
          cohortId: cohortId!,
        });
        setStreak(meData.streak || 0);
      } catch {
        // Non-critical
      }
    } catch (err) {
      const message = getErrorMessage(err);
      if (message.includes("Trial has ended") || message.includes("locked")) {
        setCanSubmit(false);
        setCohortStatus("LOCKED");
        setLockReason(message);
      }
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

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
          <div className="space-y-4">
            <div className="h-8 w-32 bg-neutral-200 dark:bg-neutral-800 rounded animate-pulse" />
            <div className="h-48 bg-neutral-200 dark:bg-neutral-800 rounded-xl animate-pulse" />
          </div>
        </PageContainer>
      </>
    );
  }

  if (loadError) {
    return (
      <>
        <Nav />
        <PageContainer size="sm">
          <Card>
            <div className="text-center py-4">
              <p className="text-red-600 dark:text-red-400 mb-4">{loadError}</p>
              <PrimaryButton onClick={fetchSubmission}>Try Again</PrimaryButton>
            </div>
          </Card>
        </PageContainer>
      </>
    );
  }

  if (needsOnboarding) {
    return (
      <>
        <Nav />
        <PageContainer size="sm">
          <Card>
            <div className="text-center py-4">
              <h2 className="text-lg font-semibold text-neutral-900 dark:text-white mb-2">
                Set up your subjects
              </h2>
              <p className="text-sm text-neutral-500 mb-6">
                Select your IB subjects to start submitting.
              </p>
              <PrimaryButton onClick={() => router.push("/onboarding")}>
                Select Subjects
              </PrimaryButton>
            </div>
          </Card>
        </PageContainer>
      </>
    );
  }

  if (!canSubmit && cohortStatus === "LOCKED") {
    return (
      <>
        <Nav />
        <PageContainer size="sm">
          <Card>
            <div className="text-center py-4">
              <h2 className="text-lg font-semibold text-neutral-900 dark:text-white mb-2">
                Submissions paused
              </h2>
              <p className="text-sm text-neutral-500 mb-6">
                {lockReason || "Trial ended. Activate to continue."}
              </p>
              <PrimaryButton onClick={() => router.push("/billing")}>
                Activate Membership
              </PrimaryButton>
            </div>
          </Card>
        </PageContainer>
      </>
    );
  }

  const isAtRisk =
    minutesLeft !== null && minutesLeft <= 60 && !existingSubmission;

  return (
    <>
      <Nav />
      <PageContainer size="sm">
        {/* Stats row */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-baseline gap-1">
            <span className="text-4xl font-semibold tabular-nums text-neutral-900 dark:text-white">
              {streak}
            </span>
            <span className="text-sm text-neutral-500">day streak</span>
          </div>
          <div className="text-right">
            <div className="flex items-baseline gap-1 justify-end">
              <span className="text-2xl font-semibold tabular-nums text-neutral-900 dark:text-white">
                {timeRemaining}
              </span>
            </div>
            <p className="text-xs text-neutral-400">until 9 PM IST</p>
          </div>
        </div>

        {/* At-risk warning */}
        {isAtRisk && (
          <div className="mb-6">
            <WarningBanner emphasis={`${minutesLeft}m`}>
              <span className="font-medium">At risk.</span> Submit now to
              maintain your streak.
            </WarningBanner>
          </div>
        )}

        {/* Already submitted indicator */}
        {existingSubmission && (
          <div className="mb-6 px-4 py-3 bg-neutral-100 dark:bg-neutral-800 rounded-lg">
            <p className="text-sm text-neutral-600 dark:text-neutral-400">
              Submitted today. You can update until 9 PM.
            </p>
          </div>
        )}

        {/* Submission form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          <Card>
            <div className="space-y-5">
              {/* Subject selector */}
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">
                  Subject
                </label>
                <select
                  value={subjectId}
                  onChange={(e) => setSubjectId(e.target.value)}
                  required
                  className="
                    w-full px-4 py-3
                    text-sm text-neutral-900 dark:text-white
                    bg-neutral-50 dark:bg-neutral-800
                    border border-neutral-200 dark:border-neutral-700
                    rounded-lg
                    focus:outline-none focus:ring-2 focus:ring-neutral-900 dark:focus:ring-white focus:ring-offset-1
                  "
                >
                  <option value="">Select subject</option>
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Bullet inputs */}
              <div className="space-y-4">
                {[
                  { value: bullet1, setter: setBullet1, num: 1 },
                  { value: bullet2, setter: setBullet2, num: 2 },
                  { value: bullet3, setter: setBullet3, num: 3 },
                ].map(({ value, setter, num }) => (
                  <div key={num} className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                        Concept {num}
                      </label>
                      {value.length > 100 && (
                        <span className="text-xs tabular-nums text-neutral-400">
                          {value.length}/140
                        </span>
                      )}
                    </div>
                    <input
                      type="text"
                      value={value}
                      onChange={(e) => setter(e.target.value.slice(0, 140))}
                      required
                      placeholder="What did you learn?"
                      className="
                        w-full px-4 py-3
                        text-sm text-neutral-900 dark:text-white
                        placeholder:text-neutral-400
                        bg-neutral-50 dark:bg-neutral-800
                        border border-neutral-200 dark:border-neutral-700
                        rounded-lg
                        focus:outline-none focus:ring-2 focus:ring-neutral-900 dark:focus:ring-white focus:ring-offset-1
                      "
                    />
                  </div>
                ))}
              </div>
            </div>
          </Card>

          {/* Error/success states */}
          {error && (
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          )}
          {success && (
            <p className="text-sm text-neutral-600 dark:text-neutral-400">
              {success}
            </p>
          )}

          {/* Submit button */}
          <PrimaryButton
            type="submit"
            loading={submitting}
            disabled={submitting}
            fullWidth
          >
            {existingSubmission ? "Update" : "Submit"}
          </PrimaryButton>
        </form>

        {/* Rank - secondary info */}
        {rank && (
          <div className="mt-8 pt-6 border-t border-neutral-200 dark:border-neutral-800 text-center">
            <p className="text-sm text-neutral-500">
              Currently ranked{" "}
              <span className="font-medium text-neutral-900 dark:text-white">
                #{rank}
              </span>{" "}
              in your cohort
            </p>
          </div>
        )}
      </PageContainer>
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
