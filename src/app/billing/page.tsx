"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Nav from "@/components/Nav";

type SubscriptionInfo = {
  status: string;
  currentPeriodEnd: string;
  isActive: boolean;
} | null;

type BillingData = {
  stripeConfigured: boolean;
  subscription: SubscriptionInfo;
  hasSubscription: boolean;
  isActive: boolean;
};

function BillingContent() {
  const searchParams = useSearchParams();
  const [data, setData] = useState<BillingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [error, setError] = useState("");

  const success = searchParams.get("success") === "true";
  const canceled = searchParams.get("canceled") === "true";

  useEffect(() => {
    fetchBillingStatus();
  }, []);

  const fetchBillingStatus = async () => {
    try {
      const res = await fetch("/api/billing");
      const result = await res.json();
      if (res.ok) {
        setData(result);
      } else {
        setError(result.error || "Failed to load billing status");
      }
    } catch {
      setError("Failed to load billing status");
    } finally {
      setLoading(false);
    }
  };

  const handleActivate = async () => {
    setCheckoutLoading(true);
    setError("");

    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const result = await res.json();

      if (!res.ok) {
        setError(result.error || "Failed to start checkout");
        return;
      }

      // Redirect to Stripe Checkout
      if (result.url) {
        window.location.href = result.url;
      }
    } catch {
      setError("Failed to start checkout");
    } finally {
      setCheckoutLoading(false);
    }
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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  return (
    <>
      <Nav />
      <div className="max-w-2xl mx-auto p-4">
        <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-6">
          Billing & Membership
        </h1>

        {success && (
          <div className="mb-6 p-4 bg-green-100 dark:bg-green-900/30 rounded-lg">
            <p className="text-green-700 dark:text-green-400">
              Payment successful! Your membership is now active.
            </p>
          </div>
        )}

        {canceled && (
          <div className="mb-6 p-4 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg">
            <p className="text-yellow-700 dark:text-yellow-400">
              Checkout was canceled. You can try again when ready.
            </p>
          </div>
        )}

        {error && (
          <div className="mb-6 p-4 bg-red-100 dark:bg-red-900/30 rounded-lg">
            <p className="text-red-700 dark:text-red-400">{error}</p>
          </div>
        )}

        {!data?.stripeConfigured ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow">
            <p className="text-gray-600 dark:text-gray-400">
              Payment system is not configured. Contact your administrator.
            </p>
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow">
            <div className="mb-6">
              <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                Current Plan
              </h2>

              {data.isActive ? (
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                    Active
                  </span>
                  <span className="text-gray-600 dark:text-gray-400">
                    Monthly Membership
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200">
                    Inactive
                  </span>
                  <span className="text-gray-600 dark:text-gray-400">
                    No active subscription
                  </span>
                </div>
              )}
            </div>

            {data.subscription && (
              <div className="mb-6 border-t border-gray-200 dark:border-gray-700 pt-4">
                <dl className="space-y-2">
                  <div className="flex justify-between">
                    <dt className="text-gray-500 dark:text-gray-400">Status</dt>
                    <dd className="text-gray-900 dark:text-white capitalize">
                      {data.subscription.status}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-500 dark:text-gray-400">
                      {data.isActive ? "Renews" : "Expires"}
                    </dt>
                    <dd className="text-gray-900 dark:text-white">
                      {formatDate(data.subscription.currentPeriodEnd)}
                    </dd>
                  </div>
                </dl>
              </div>
            )}

            {!data.isActive && (
              <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
                <h3 className="text-base font-medium text-gray-900 dark:text-white mb-2">
                  Activate Membership
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  Get unlimited access to daily submissions and help your cohort
                  reach the activation threshold.
                </p>
                <button
                  onClick={handleActivate}
                  disabled={checkoutLoading}
                  className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-md font-medium"
                >
                  {checkoutLoading ? "Loading..." : "Activate Membership"}
                </button>
              </div>
            )}
          </div>
        )}

        <div className="mt-6 bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4">
          <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
            How cohort activation works
          </h3>
          <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
            <li>- New cohorts start with a 14-day trial period</li>
            <li>- During trial, all members can submit normally</li>
            <li>- Cohort unlocks permanently when 6 members activate</li>
            <li>- If trial ends before activation, submissions pause</li>
          </ul>
        </div>
      </div>
    </>
  );
}

export default function BillingPage() {
  return (
    <Suspense
      fallback={
        <>
          <Nav />
          <div className="max-w-2xl mx-auto p-4">
            <p className="text-gray-600 dark:text-gray-400">Loading...</p>
          </div>
        </>
      }
    >
      <BillingContent />
    </Suspense>
  );
}
