"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Nav from "@/components/Nav";
import OnboardingProgress from "@/components/OnboardingProgress";
import { PageContainer, Card, PrimaryButton } from "@/components/ui";
import { apiGet, apiPost, getErrorMessage } from "@/lib/api-client";

const ONBOARDING_STEPS = [
  { label: "Subjects", description: "Select your IB subjects" },
  { label: "Cohort", description: "Join or create a study group" },
  { label: "Units", description: "Choose weekly focus units" },
];

type CohortStatusInfo = {
  status: "TRIAL" | "ACTIVE" | "LOCKED";
  trialEndsAt: string;
  activatedAt: string | null;
  paidCount: number;
  memberCount: number;
  isTrialExpired: boolean;
  daysUntilTrialEnd: number;
  showActivationCounter: boolean;
  canSubmit: boolean;
};

type Cohort = {
  id: string;
  name: string;
  joinCode: string;
  memberCount: number;
  isActive: boolean;
  role: string;
  status: string;
  trialEndsAt: string;
};

type CohortListResponse = {
  cohorts: Cohort[];
  activeCohortId: string | null;
  activeCohortStatus: CohortStatusInfo | null;
};

type CohortActionResponse = {
  id: string;
  name: string;
  joinCode: string;
  isActive: boolean;
  status: string;
  trialEndsAt: string;
  statusInfo?: CohortStatusInfo;
};

const ACTIVATION_THRESHOLD = 6;

function CohortContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isOnboarding = searchParams.get("onboarding") === "true";
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [activeCohortId, setActiveCohortId] = useState<string | null>(null);
  const [activeCohortStatus, setActiveCohortStatus] =
    useState<CohortStatusInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [name, setName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchCohorts();
  }, []);

  const fetchCohorts = async () => {
    setLoadError("");
    try {
      const data = await apiGet<CohortListResponse>("/api/cohort");
      setCohorts(data.cohorts);
      setActiveCohortId(data.activeCohortId);
      setActiveCohortStatus(data.activeCohortStatus);
    } catch (err) {
      setLoadError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    setError("");
    setSubmitting(true);

    try {
      const data = await apiPost<CohortActionResponse>("/api/cohort", {
        action: "create",
        name,
      });
      setName("");
      setShowCreate(false);
      router.push(`/submit?cohortId=${data.id}`);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    setError("");
    setSubmitting(true);

    try {
      const data = await apiPost<CohortActionResponse>("/api/cohort", {
        action: "join",
        joinCode,
      });
      setJoinCode("");
      setShowJoin(false);
      router.push(`/submit?cohortId=${data.id}`);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const selectCohort = async (cohortId: string) => {
    setError("");
    try {
      await apiPost<CohortActionResponse>("/api/cohort", {
        action: "setActive",
        cohortId,
      });
      router.push(`/submit?cohortId=${cohortId}`);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "ACTIVE":
        return (
          <span className="text-[10px] font-medium uppercase tracking-wide px-1.5 py-0.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 rounded">
            Active
          </span>
        );
      case "LOCKED":
        return (
          <span className="text-[10px] font-medium uppercase tracking-wide px-1.5 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded">
            Locked
          </span>
        );
      case "TRIAL":
      default:
        return (
          <span className="text-[10px] font-medium uppercase tracking-wide px-1.5 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded">
            Trial
          </span>
        );
    }
  };

  const formatTrialEnd = (trialEndsAt: string) => {
    const date = new Date(trialEndsAt);
    const now = new Date();
    const daysLeft = Math.ceil(
      (date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
    );

    if (daysLeft <= 0) return "Trial ended";
    if (daysLeft === 1) return "1 day left";
    return `${daysLeft} days left`;
  };

  if (loading) {
    return (
      <>
        {!isOnboarding && <Nav />}
        <PageContainer>
          <div className="flex items-center justify-center py-16">
            <div className="w-5 h-5 border-2 border-neutral-300 border-t-neutral-600 rounded-full animate-spin" />
          </div>
        </PageContainer>
      </>
    );
  }

  if (loadError) {
    return (
      <>
        {!isOnboarding && <Nav />}
        <PageContainer>
          <div className="text-center py-16">
            <p className="text-red-600 dark:text-red-400 mb-4">{loadError}</p>
            <PrimaryButton onClick={fetchCohorts}>Try Again</PrimaryButton>
          </div>
        </PageContainer>
      </>
    );
  }

  return (
    <>
      {!isOnboarding && <Nav />}
      <div
        className={
          isOnboarding ? "min-h-screen bg-neutral-50 dark:bg-neutral-900" : ""
        }
      >
        <PageContainer>
          {isOnboarding && (
            <OnboardingProgress
              currentStep={2}
              totalSteps={3}
              steps={ONBOARDING_STEPS}
            />
          )}

          {/* Header */}
          <div className="flex items-start justify-between mb-8">
            <div>
              <h1 className="text-2xl font-semibold text-neutral-900 dark:text-white">
                {isOnboarding ? "Join or Create a Cohort" : "Your Cohorts"}
              </h1>
              <p className="mt-1 text-sm text-neutral-500">
                {isOnboarding
                  ? "A cohort is your study group for daily accountability"
                  : "Select one cohort to be active for submissions"}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setShowJoin(true);
                  setShowCreate(false);
                  setError("");
                }}
                className="px-3 py-1.5 text-sm bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 rounded-lg transition-colors"
              >
                Join
              </button>
              <button
                onClick={() => {
                  setShowCreate(true);
                  setShowJoin(false);
                  setError("");
                }}
                className="px-3 py-1.5 text-sm bg-neutral-900 hover:bg-neutral-800 dark:bg-white dark:hover:bg-neutral-100 text-white dark:text-neutral-900 rounded-lg transition-colors"
              >
                Create
              </button>
            </div>
          </div>

          {/* Active cohort status banner */}
          {activeCohortStatus && activeCohortId && (
            <div
              className={`mb-6 p-4 rounded-xl border ${
                activeCohortStatus.status === "LOCKED"
                  ? "bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800/50"
                  : activeCohortStatus.status === "ACTIVE"
                    ? "bg-emerald-50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800/50"
                    : "bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800/50"
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    {getStatusBadge(activeCohortStatus.status)}
                    {activeCohortStatus.status === "TRIAL" && (
                      <span className="text-xs text-neutral-500">
                        {formatTrialEnd(activeCohortStatus.trialEndsAt)}
                      </span>
                    )}
                  </div>

                  {activeCohortStatus.status === "LOCKED" && (
                    <p className="text-sm text-red-700 dark:text-red-400">
                      Trial ended. Activate membership to continue.
                    </p>
                  )}

                  {activeCohortStatus.status === "ACTIVE" && (
                    <p className="text-sm text-emerald-700 dark:text-emerald-400">
                      Cohort is fully activated.
                    </p>
                  )}

                  {activeCohortStatus.showActivationCounter &&
                    activeCohortStatus.status !== "ACTIVE" && (
                      <div className="mt-2">
                        <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                          {activeCohortStatus.paidCount}/{ACTIVATION_THRESHOLD}{" "}
                          activated
                        </p>
                        <p className="text-xs text-neutral-500">
                          Cohort unlocks when {ACTIVATION_THRESHOLD} members
                          activate.
                        </p>
                      </div>
                    )}
                </div>

                {activeCohortStatus.status === "LOCKED" && (
                  <PrimaryButton onClick={() => router.push("/billing")}>
                    Activate
                  </PrimaryButton>
                )}
              </div>
            </div>
          )}

          {/* Create form */}
          {showCreate && (
            <Card padding="md">
              <h2 className="font-medium text-neutral-900 dark:text-white mb-1">
                Create New Cohort
              </h2>
              <p className="text-xs text-neutral-500 mb-4">
                New cohorts start with a 14-day trial period.
              </p>
              <form onSubmit={handleCreate} className="flex gap-2">
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Cohort name"
                  required
                  className="flex-1 px-3 py-2 text-sm border border-neutral-200 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white placeholder:text-neutral-400 focus:outline-none focus:ring-1 focus:ring-neutral-900 dark:focus:ring-white"
                />
                <PrimaryButton
                  type="submit"
                  disabled={submitting}
                  loading={submitting}
                >
                  Create
                </PrimaryButton>
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="px-3 py-2 text-sm text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
                >
                  Cancel
                </button>
              </form>
            </Card>
          )}

          {/* Join form */}
          {showJoin && (
            <Card padding="md">
              <h2 className="font-medium text-neutral-900 dark:text-white mb-3">
                Join Cohort
              </h2>
              <form onSubmit={handleJoin} className="flex gap-2">
                <input
                  type="text"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  placeholder="Enter join code"
                  required
                  maxLength={6}
                  className="flex-1 px-3 py-2 text-sm border border-neutral-200 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white placeholder:text-neutral-400 uppercase tracking-wider focus:outline-none focus:ring-1 focus:ring-neutral-900 dark:focus:ring-white"
                />
                <PrimaryButton
                  type="submit"
                  disabled={submitting}
                  loading={submitting}
                >
                  Join
                </PrimaryButton>
                <button
                  type="button"
                  onClick={() => setShowJoin(false)}
                  className="px-3 py-2 text-sm text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
                >
                  Cancel
                </button>
              </form>
            </Card>
          )}

          {/* Error */}
          {error && (
            <div className="my-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 rounded-lg">
              <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
            </div>
          )}

          {/* Cohort list */}
          {cohorts.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-neutral-500 mb-2">
                You haven&apos;t joined any cohorts yet.
              </p>
              <p className="text-sm text-neutral-400">
                Create a new cohort or join one with a code.
              </p>
            </div>
          ) : (
            <div className="space-y-3 mt-6">
              {cohorts.map((cohort) => (
                <div
                  key={cohort.id}
                  onClick={() => selectCohort(cohort.id)}
                  className={`
                    p-4 bg-white dark:bg-neutral-800/50 rounded-xl border cursor-pointer
                    transition-all hover:border-neutral-300 dark:hover:border-neutral-600
                    ${
                      cohort.isActive
                        ? "border-neutral-900 dark:border-white"
                        : "border-neutral-200 dark:border-neutral-700/50"
                    }
                  `}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-medium text-neutral-900 dark:text-white">
                          {cohort.name}
                        </h3>
                        {cohort.isActive && (
                          <span className="text-[10px] font-medium uppercase tracking-wide px-1.5 py-0.5 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 rounded">
                            Selected
                          </span>
                        )}
                        {getStatusBadge(cohort.status)}
                        {cohort.role === "OWNER" && (
                          <span className="text-[10px] font-medium uppercase tracking-wide px-1.5 py-0.5 bg-neutral-100 dark:bg-neutral-700 text-neutral-500 rounded">
                            Owner
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-neutral-500">
                        {cohort.memberCount} member
                        {cohort.memberCount !== 1 ? "s" : ""} · Code:{" "}
                        {cohort.joinCode}
                        {cohort.status === "TRIAL" && (
                          <> · {formatTrialEnd(cohort.trialEndsAt)}</>
                        )}
                      </p>
                    </div>
                    <span className="text-neutral-300 dark:text-neutral-600">
                      →
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </PageContainer>
      </div>
    </>
  );
}

export default function CohortPage() {
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
      <CohortContent />
    </Suspense>
  );
}
