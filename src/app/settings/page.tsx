"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Nav from "@/components/Nav";
import { PageContainer, Card, PrimaryButton } from "@/components/ui";

interface NotificationPrefs {
  isEnabled: boolean;
  remindTimeMinutesBeforeCutoff: number;
  lastCallMinutesBeforeCutoff: number;
  quietHoursStart: number | null;
  quietHoursEnd: number | null;
}

const REMIND_OPTIONS = [
  { value: 120, label: "2 hours before" },
  { value: 90, label: "1.5 hours before" },
  { value: 60, label: "1 hour before" },
  { value: 30, label: "30 minutes before" },
];

const LAST_CALL_OPTIONS = [
  { value: 30, label: "30 minutes before" },
  { value: 15, label: "15 minutes before" },
  { value: 10, label: "10 minutes before" },
];

const HOUR_OPTIONS = Array.from({ length: 24 }, (_, i) => ({
  value: i,
  label: `${i.toString().padStart(2, "0")}:00`,
}));

export default function SettingsPage() {
  const router = useRouter();
  const [prefs, setPrefs] = useState<NotificationPrefs | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [quietHoursEnabled, setQuietHoursEnabled] = useState(false);

  const fetchPrefs = useCallback(async () => {
    try {
      const res = await fetch("/api/notification-prefs");
      if (!res.ok) {
        if (res.status === 401) {
          router.push("/login");
          return;
        }
        throw new Error("Failed to fetch preferences");
      }
      const data = await res.json();
      setPrefs(data);
      setQuietHoursEnabled(data.quietHoursStart !== null);
    } catch (error) {
      console.error("Error fetching prefs:", error);
      setMessage({ type: "error", text: "Failed to load preferences" });
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchPrefs();
  }, [fetchPrefs]);

  async function savePrefs() {
    if (!prefs) return;

    setSaving(true);
    setMessage(null);

    try {
      const res = await fetch("/api/notification-prefs", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...prefs,
          quietHoursStart: quietHoursEnabled ? prefs.quietHoursStart : null,
          quietHoursEnd: quietHoursEnabled ? prefs.quietHoursEnd : null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save preferences");
      }

      const data = await res.json();
      setPrefs(data);
      setMessage({ type: "success", text: "Preferences saved" });
    } catch (error) {
      console.error("Error saving prefs:", error);
      setMessage({
        type: "error",
        text:
          error instanceof Error ? error.message : "Failed to save preferences",
      });
    } finally {
      setSaving(false);
    }
  }

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

  if (!prefs) {
    return (
      <>
        <Nav />
        <PageContainer>
          <p className="text-red-500">Failed to load preferences</p>
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
          <h1 className="text-2xl font-semibold text-neutral-900 dark:text-white">
            Settings
          </h1>
          <p className="mt-1 text-sm text-neutral-500">
            Manage your notification preferences
          </p>
        </div>

        <Card padding="lg">
          <div className="space-y-6">
            {/* Email Notifications Toggle */}
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium text-neutral-900 dark:text-white">
                  Email Reminders
                </h3>
                <p className="text-xs text-neutral-500 mt-0.5">
                  Receive reminder emails before the daily deadline
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  setPrefs({ ...prefs, isEnabled: !prefs.isEnabled })
                }
                className={`
                  relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full
                  border-2 border-transparent transition-colors duration-200 ease-in-out
                  focus:outline-none focus:ring-2 focus:ring-neutral-900 dark:focus:ring-white focus:ring-offset-2
                  ${prefs.isEnabled ? "bg-neutral-900 dark:bg-white" : "bg-neutral-200 dark:bg-neutral-700"}
                `}
              >
                <span
                  className={`
                    pointer-events-none inline-block h-5 w-5 transform rounded-full
                    bg-white dark:bg-neutral-900 shadow ring-0 transition duration-200 ease-in-out
                    ${prefs.isEnabled ? "translate-x-5" : "translate-x-0"}
                  `}
                />
              </button>
            </div>

            {prefs.isEnabled && (
              <>
                {/* First Reminder Time */}
                <div className="pt-4 border-t border-neutral-100 dark:border-neutral-700/50">
                  <label className="block text-sm font-medium text-neutral-900 dark:text-white mb-2">
                    First Reminder
                  </label>
                  <select
                    value={prefs.remindTimeMinutesBeforeCutoff}
                    onChange={(e) =>
                      setPrefs({
                        ...prefs,
                        remindTimeMinutesBeforeCutoff: parseInt(e.target.value),
                      })
                    }
                    className="w-full px-3 py-2 text-sm border border-neutral-200 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-neutral-900 dark:focus:ring-white"
                  >
                    {REMIND_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-neutral-400">
                    When to send the first reminder before 9 PM IST
                  </p>
                </div>

                {/* Last Call Time */}
                <div>
                  <label className="block text-sm font-medium text-neutral-900 dark:text-white mb-2">
                    Last Call Reminder
                  </label>
                  <select
                    value={prefs.lastCallMinutesBeforeCutoff}
                    onChange={(e) =>
                      setPrefs({
                        ...prefs,
                        lastCallMinutesBeforeCutoff: parseInt(e.target.value),
                      })
                    }
                    className="w-full px-3 py-2 text-sm border border-neutral-200 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-neutral-900 dark:focus:ring-white"
                  >
                    {LAST_CALL_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-neutral-400">
                    Final urgent reminder if you still haven&apos;t submitted
                  </p>
                </div>

                {/* Quiet Hours */}
                <div className="pt-4 border-t border-neutral-100 dark:border-neutral-700/50">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-sm font-medium text-neutral-900 dark:text-white">
                        Quiet Hours
                      </h3>
                      <p className="text-xs text-neutral-500 mt-0.5">
                        Don&apos;t send emails during specific hours
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setQuietHoursEnabled(!quietHoursEnabled);
                        if (!quietHoursEnabled) {
                          setPrefs({
                            ...prefs,
                            quietHoursStart: 22,
                            quietHoursEnd: 7,
                          });
                        }
                      }}
                      className={`
                        relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full
                        border-2 border-transparent transition-colors duration-200 ease-in-out
                        focus:outline-none focus:ring-2 focus:ring-neutral-900 dark:focus:ring-white focus:ring-offset-2
                        ${quietHoursEnabled ? "bg-neutral-900 dark:bg-white" : "bg-neutral-200 dark:bg-neutral-700"}
                      `}
                    >
                      <span
                        className={`
                          pointer-events-none inline-block h-5 w-5 transform rounded-full
                          bg-white dark:bg-neutral-900 shadow ring-0 transition duration-200 ease-in-out
                          ${quietHoursEnabled ? "translate-x-5" : "translate-x-0"}
                        `}
                      />
                    </button>
                  </div>

                  {quietHoursEnabled && (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-neutral-500 mb-1.5">
                          Start
                        </label>
                        <select
                          value={prefs.quietHoursStart ?? 22}
                          onChange={(e) =>
                            setPrefs({
                              ...prefs,
                              quietHoursStart: parseInt(e.target.value),
                            })
                          }
                          className="w-full px-3 py-2 text-sm border border-neutral-200 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-neutral-900 dark:focus:ring-white"
                        >
                          {HOUR_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-neutral-500 mb-1.5">
                          End
                        </label>
                        <select
                          value={prefs.quietHoursEnd ?? 7}
                          onChange={(e) =>
                            setPrefs({
                              ...prefs,
                              quietHoursEnd: parseInt(e.target.value),
                            })
                          }
                          className="w-full px-3 py-2 text-sm border border-neutral-200 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-neutral-900 dark:focus:ring-white"
                        >
                          {HOUR_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Message */}
            {message && (
              <div
                className={`
                  p-3 rounded-lg text-sm
                  ${
                    message.type === "success"
                      ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400"
                      : "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400"
                  }
                `}
              >
                {message.text}
              </div>
            )}

            {/* Save Button */}
            <div className="pt-4">
              <PrimaryButton
                onClick={savePrefs}
                disabled={saving}
                loading={saving}
                fullWidth
              >
                Save Preferences
              </PrimaryButton>
            </div>
          </div>
        </Card>

        {/* Back Link */}
        <div className="mt-6 text-center">
          <button
            onClick={() => router.back()}
            className="text-sm text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
          >
            Back
          </button>
        </div>
      </PageContainer>
    </>
  );
}
