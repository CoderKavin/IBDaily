"use client";

import { useState } from "react";

type ReportReason = "WRONG" | "CONFUSING" | "TOO_HARSH" | "OTHER";

interface FeedbackReportButtonProps {
  submissionId: string;
  onReported?: () => void;
}

const REASON_LABELS: Record<ReportReason, string> = {
  WRONG: "Incorrect information",
  CONFUSING: "Confusing or unclear",
  TOO_HARSH: "Too harsh or discouraging",
  OTHER: "Other issue",
};

export default function FeedbackReportButton({
  submissionId,
  onReported,
}: FeedbackReportButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!reason) {
      setError("Please select a reason");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/feedback-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          submissionId,
          reason,
          notes: notes.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to submit report");
      }

      setSubmitted(true);
      setIsOpen(false);
      onReported?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <span className="text-xs text-gray-500 dark:text-gray-400">
        Reported
      </span>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 underline"
      >
        Report issue
      </button>

      {isOpen && (
        <div className="absolute right-0 top-6 z-10 w-72 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-4">
          <h4 className="font-medium text-gray-900 dark:text-white text-sm mb-3">
            Report AI Feedback Issue
          </h4>

          <div className="space-y-2 mb-3">
            {(Object.keys(REASON_LABELS) as ReportReason[]).map((r) => (
              <label
                key={r}
                className="flex items-center gap-2 text-sm cursor-pointer"
              >
                <input
                  type="radio"
                  name="reason"
                  checked={reason === r}
                  onChange={() => setReason(r)}
                  className="text-blue-600"
                />
                <span className="text-gray-700 dark:text-gray-300">
                  {REASON_LABELS[r]}
                </span>
              </label>
            ))}
          </div>

          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Additional details (optional)"
            maxLength={500}
            rows={2}
            className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-md px-2 py-1 bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
          />

          {error && (
            <p className="text-xs text-red-500 mt-1">{error}</p>
          )}

          <div className="flex justify-end gap-2 mt-3">
            <button
              onClick={() => setIsOpen(false)}
              className="px-3 py-1 text-xs text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting || !reason}
              className="px-3 py-1 text-xs bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-md"
            >
              {submitting ? "Submitting..." : "Submit Report"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
