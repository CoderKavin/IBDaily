"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Nav from "@/components/Nav";

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

const ACTIVATION_THRESHOLD = 6;

export default function CohortPage() {
  const router = useRouter();
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [activeCohortId, setActiveCohortId] = useState<string | null>(null);
  const [activeCohortStatus, setActiveCohortStatus] =
    useState<CohortStatusInfo | null>(null);
  const [loading, setLoading] = useState(true);
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
    try {
      const res = await fetch("/api/cohort");
      const data = await res.json();
      if (res.ok) {
        setCohorts(data.cohorts);
        setActiveCohortId(data.activeCohortId);
        setActiveCohortStatus(data.activeCohortStatus);
      }
    } catch {
      console.error("Failed to fetch cohorts");
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const res = await fetch("/api/cohort", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create", name }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error);
      } else {
        setName("");
        setShowCreate(false);
        router.push(`/submit?cohortId=${data.id}`);
      }
    } catch {
      setError("Failed to create cohort");
    } finally {
      setSubmitting(false);
    }
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const res = await fetch("/api/cohort", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "join", joinCode }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error);
      } else {
        setJoinCode("");
        setShowJoin(false);
        router.push(`/submit?cohortId=${data.id}`);
      }
    } catch {
      setError("Failed to join cohort");
    } finally {
      setSubmitting(false);
    }
  };

  const selectCohort = async (cohortId: string) => {
    setError("");
    try {
      const res = await fetch("/api/cohort", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "setActive", cohortId }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error);
      } else {
        router.push(`/submit?cohortId=${cohortId}`);
      }
    } catch {
      setError("Failed to select cohort");
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "ACTIVE":
        return (
          <span className="text-xs px-2 py-0.5 bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 rounded">
            Active
          </span>
        );
      case "LOCKED":
        return (
          <span className="text-xs px-2 py-0.5 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 rounded">
            Locked
          </span>
        );
      case "TRIAL":
      default:
        return (
          <span className="text-xs px-2 py-0.5 bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300 rounded">
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
        <Nav />
        <div className="max-w-4xl mx-auto p-4">
          <p className="text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </>
    );
  }

  return (
    <>
      <Nav />
      <div className="max-w-4xl mx-auto p-4">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">
              Your Cohorts
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Select one cohort to be active for submissions
            </p>
          </div>
          <div className="flex space-x-2">
            <button
              onClick={() => {
                setShowJoin(true);
                setShowCreate(false);
                setError("");
              }}
              className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-white rounded-md"
            >
              Join
            </button>
            <button
              onClick={() => {
                setShowCreate(true);
                setShowJoin(false);
                setError("");
              }}
              className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-md"
            >
              Create
            </button>
          </div>
        </div>

        {/* Active cohort status banner */}
        {activeCohortStatus && activeCohortId && (
          <div
            className={`mb-6 p-4 rounded-lg ${
              activeCohortStatus.status === "LOCKED"
                ? "bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800"
                : activeCohortStatus.status === "ACTIVE"
                  ? "bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800"
                  : "bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800"
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  {getStatusBadge(activeCohortStatus.status)}
                  {activeCohortStatus.status === "TRIAL" && (
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      {formatTrialEnd(activeCohortStatus.trialEndsAt)}
                    </span>
                  )}
                </div>

                {activeCohortStatus.status === "LOCKED" && (
                  <p className="text-sm text-red-700 dark:text-red-400">
                    Trial ended. Activate membership to continue submitting.
                  </p>
                )}

                {activeCohortStatus.status === "ACTIVE" && (
                  <p className="text-sm text-green-700 dark:text-green-400">
                    Cohort is fully activated. Submissions are enabled.
                  </p>
                )}

                {/* Activation counter - only show when paidCount >= 4 */}
                {activeCohortStatus.showActivationCounter &&
                  activeCohortStatus.status !== "ACTIVE" && (
                    <div className="mt-2">
                      <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Activation: {activeCohortStatus.paidCount}/
                        {ACTIVATION_THRESHOLD}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Unlocks when {ACTIVATION_THRESHOLD} members activate.
                      </p>
                    </div>
                  )}
              </div>

              {activeCohortStatus.status === "LOCKED" && (
                <button
                  onClick={() => router.push("/billing")}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-md"
                >
                  Activate
                </button>
              )}
            </div>
          </div>
        )}

        {showCreate && (
          <div className="mb-6 p-4 bg-white dark:bg-gray-800 rounded-lg shadow">
            <h2 className="font-medium mb-3 text-gray-900 dark:text-white">
              Create New Cohort
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
              New cohorts start with a 14-day trial period.
            </p>
            <form onSubmit={handleCreate} className="flex space-x-2">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Cohort name"
                required
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-md"
              >
                {submitting ? "..." : "Create"}
              </button>
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="px-4 py-2 text-gray-600 dark:text-gray-400"
              >
                Cancel
              </button>
            </form>
          </div>
        )}

        {showJoin && (
          <div className="mb-6 p-4 bg-white dark:bg-gray-800 rounded-lg shadow">
            <h2 className="font-medium mb-3 text-gray-900 dark:text-white">
              Join Cohort
            </h2>
            <form onSubmit={handleJoin} className="flex space-x-2">
              <input
                type="text"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder="Enter join code"
                required
                maxLength={6}
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white uppercase"
              />
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-md"
              >
                {submitting ? "..." : "Join"}
              </button>
              <button
                type="button"
                onClick={() => setShowJoin(false)}
                className="px-4 py-2 text-gray-600 dark:text-gray-400"
              >
                Cancel
              </button>
            </form>
          </div>
        )}

        {error && (
          <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/30 rounded-lg">
            <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
          </div>
        )}

        {cohorts.length === 0 ? (
          <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg">
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              You haven&apos;t joined any cohorts yet.
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-500">
              Create a new cohort or join one with a code.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {cohorts.map((cohort) => (
              <div
                key={cohort.id}
                onClick={() => selectCohort(cohort.id)}
                className={`p-4 bg-white dark:bg-gray-800 rounded-lg shadow cursor-pointer hover:shadow-md transition ${
                  cohort.isActive ? "ring-2 ring-blue-500" : ""
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-medium text-gray-900 dark:text-white">
                        {cohort.name}
                      </h3>
                      {cohort.isActive && (
                        <span className="text-xs px-2 py-0.5 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded">
                          Selected
                        </span>
                      )}
                      {getStatusBadge(cohort.status)}
                      {cohort.role === "OWNER" && (
                        <span className="text-xs px-2 py-0.5 bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 rounded">
                          Owner
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {cohort.memberCount} member
                      {cohort.memberCount !== 1 ? "s" : ""} · Code:{" "}
                      {cohort.joinCode}
                      {cohort.status === "TRIAL" && (
                        <> · {formatTrialEnd(cohort.trialEndsAt)}</>
                      )}
                    </p>
                  </div>
                  <span className="text-gray-400">→</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
