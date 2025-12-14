"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Nav from "@/components/Nav";
import { PageContainer, Card, PrimaryButton } from "@/components/ui";

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
        <PageContainer>
          <div className="flex items-center justify-center py-16">
            <div className="w-5 h-5 border-2 border-neutral-300 border-t-neutral-600 rounded-full animate-spin" />
          </div>
        </PageContainer>
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
      <PageContainer>
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-neutral-900 dark:text-white">
            Membership
          </h1>
        </div>

        {/* Success message */}
        {success && (
          <div className="mb-6 p-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/50 rounded-xl">
            <p className="text-sm text-emerald-700 dark:text-emerald-400">
              Payment successful. Your membership is now active.
            </p>
          </div>
        )}

        {/* Canceled message */}
        {canceled && (
          <div className="mb-6 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 rounded-xl">
            <p className="text-sm text-amber-700 dark:text-amber-400">
              Checkout was canceled. You can try again when ready.
            </p>
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 rounded-xl">
            <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
          </div>
        )}

        {!data?.stripeConfigured ? (
          <Card>
            <p className="text-neutral-500">
              Payment system is not configured. Contact your administrator.
            </p>
          </Card>
        ) : (
          <Card padding="lg">
            {/* Current status */}
            <div className="mb-6">
              <p className="text-xs font-medium uppercase tracking-wider text-neutral-400 mb-2">
                Current Plan
              </p>

              {data.isActive ? (
                <div className="flex items-center gap-3">
                  <span className="px-2 py-1 text-xs font-medium bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 rounded">
                    Active
                  </span>
                  <span className="text-neutral-600 dark:text-neutral-400">
                    Monthly Membership
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <span className="px-2 py-1 text-xs font-medium bg-neutral-100 dark:bg-neutral-700 text-neutral-500 rounded">
                    Inactive
                  </span>
                  <span className="text-neutral-500">
                    No active subscription
                  </span>
                </div>
              )}
            </div>

            {/* Subscription details */}
            {data.subscription && (
              <div className="mb-6 pt-6 border-t border-neutral-100 dark:border-neutral-700/50">
                <dl className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <dt className="text-neutral-500">Status</dt>
                    <dd className="text-neutral-900 dark:text-white capitalize">
                      {data.subscription.status}
                    </dd>
                  </div>
                  <div className="flex justify-between text-sm">
                    <dt className="text-neutral-500">
                      {data.isActive ? "Renews" : "Expires"}
                    </dt>
                    <dd className="text-neutral-900 dark:text-white">
                      {formatDate(data.subscription.currentPeriodEnd)}
                    </dd>
                  </div>
                </dl>
              </div>
            )}

            {/* Activate button */}
            {!data.isActive && (
              <div className="pt-6 border-t border-neutral-100 dark:border-neutral-700/50">
                <h3 className="font-medium text-neutral-900 dark:text-white mb-2">
                  Activate Membership
                </h3>
                <p className="text-sm text-neutral-500 mb-4">
                  Get unlimited access and help your cohort reach the activation
                  threshold.
                </p>
                <PrimaryButton
                  onClick={handleActivate}
                  disabled={checkoutLoading}
                  loading={checkoutLoading}
                  fullWidth
                >
                  Activate Membership
                </PrimaryButton>
              </div>
            )}
          </Card>
        )}

        {/* Info box */}
        <div className="mt-6 p-4 bg-neutral-100 dark:bg-neutral-800/50 rounded-xl">
          <h3 className="text-sm font-medium text-neutral-900 dark:text-white mb-2">
            How cohort activation works
          </h3>
          <ul className="text-sm text-neutral-500 space-y-1">
            <li>New cohorts start with a 14-day trial</li>
            <li>During trial, all members can submit normally</li>
            <li>Cohort unlocks permanently when 6 members activate</li>
            <li>If trial ends before activation, submissions pause</li>
          </ul>
        </div>
      </PageContainer>
    </>
  );
}

export default function BillingPage() {
  return (
    <Suspense
      fallback={
        <>
          <Nav />
          <PageContainer>
            <div className="flex items-center justify-center py-16">
              <div className="w-5 h-5 border-2 border-neutral-300 border-t-neutral-600 rounded-full animate-spin" />
            </div>
          </PageContainer>
        </>
      }
    >
      <BillingContent />
    </Suspense>
  );
}
