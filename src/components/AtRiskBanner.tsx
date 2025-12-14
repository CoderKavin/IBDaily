"use client";

import { useState, useEffect, useMemo } from "react";

interface AtRiskBannerProps {
  hasSubmittedToday: boolean;
}

/**
 * AtRiskBanner - Shows a warning when user is within 60 minutes of deadline
 * without having submitted today.
 */
export default function AtRiskBanner({ hasSubmittedToday }: AtRiskBannerProps) {
  const [minutesRemaining, setMinutesRemaining] = useState<number | null>(null);

  useEffect(() => {
    const checkAtRisk = () => {
      const now = new Date();

      // Get today's date in IST
      const formatter = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Kolkata",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      });
      const todayIST = formatter.format(now);

      // Create deadline: today at 21:00 IST (+05:30)
      const deadlineISO = `${todayIST}T21:00:00+05:30`;
      const deadline = new Date(deadlineISO);

      const diffMs = deadline.getTime() - now.getTime();

      // Past deadline or more than 60 min away
      if (diffMs <= 0 || diffMs > 60 * 60 * 1000) {
        setMinutesRemaining(null);
        return;
      }

      const diffMinutes = Math.floor(diffMs / (1000 * 60));
      setMinutesRemaining(diffMinutes);
    };

    // Check immediately
    checkAtRisk();

    // Update every minute
    const interval = setInterval(checkAtRisk, 60000);

    return () => clearInterval(interval);
  }, []);

  // Derive isAtRisk from props and state without setState
  const isAtRisk = useMemo(() => {
    return (
      !hasSubmittedToday && minutesRemaining !== null && minutesRemaining <= 60
    );
  }, [hasSubmittedToday, minutesRemaining]);

  // Don't render if not at risk
  if (!isAtRisk || minutesRemaining === null) {
    return null;
  }

  const formatTime = (minutes: number): string => {
    if (minutes <= 0) return "less than 1 minute";
    if (minutes === 1) return "1 minute";
    if (minutes < 60) return `${minutes} minutes`;
    return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
  };

  return (
    <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 mb-4">
      <div className="flex items-start gap-3">
        <span className="text-amber-600 dark:text-amber-400 text-lg flex-shrink-0">
          ⚠
        </span>
        <div className="flex-1">
          <p className="text-amber-800 dark:text-amber-200 font-medium">
            At risk of missing today
          </p>
          <p className="text-amber-700 dark:text-amber-300 text-sm mt-1">
            Less than {formatTime(minutesRemaining)} left until the 9:00 PM IST
            deadline.
          </p>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-amber-800 dark:text-amber-200 font-mono text-lg font-bold">
            {minutesRemaining}
          </p>
          <p className="text-amber-600 dark:text-amber-400 text-xs">min left</p>
        </div>
      </div>
    </div>
  );
}
