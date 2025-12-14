"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Nav from "@/components/Nav";

type Cohort = {
  id: string;
  name: string;
  joinCode: string;
  memberCount: number;
  isActive: boolean;
};

export default function CohortPage() {
  const router = useRouter();
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [activeCohortId, setActiveCohortId] = useState<string | null>(null);
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
        // Navigate to submit page with active cohort
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
        // Navigate to submit page with active cohort
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

        {showCreate && (
          <div className="mb-6 p-4 bg-white dark:bg-gray-800 rounded-lg shadow">
            <h2 className="font-medium mb-3 text-gray-900 dark:text-white">
              Create New Cohort
            </h2>
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
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-gray-900 dark:text-white">
                        {cohort.name}
                      </h3>
                      {cohort.isActive && (
                        <span className="text-xs px-2 py-0.5 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded">
                          Active
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {cohort.memberCount} member
                      {cohort.memberCount !== 1 ? "s" : ""} · Code:{" "}
                      {cohort.joinCode}
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
