/**
 * Cohort status utilities for payment/activation logic
 */

export type CohortStatus = "TRIAL" | "ACTIVE" | "LOCKED";

export const ACTIVATION_THRESHOLD = 6; // Number of paid members to activate cohort
export const TRIAL_DAYS = 14;
export const COUNTER_VISIBILITY_THRESHOLD = 4; // Show counter when paidCount >= 4

export interface CohortStatusInfo {
  status: CohortStatus;
  trialEndsAt: Date;
  activatedAt: Date | null;
  paidCount: number;
  memberCount: number;
  isTrialExpired: boolean;
  daysUntilTrialEnd: number;
  showActivationCounter: boolean;
  canSubmit: boolean;
}

/**
 * Compute the effective cohort status based on current state and paid members
 * This is the source of truth for cohort status logic
 */
export function computeCohortStatus(params: {
  currentStatus: CohortStatus;
  trialEndsAt: Date;
  activatedAt: Date | null;
  paidCount: number;
  memberCount: number;
  now?: Date;
}): CohortStatusInfo {
  const now = params.now || new Date();
  const isTrialExpired = now > params.trialEndsAt;
  const daysUntilTrialEnd = Math.max(
    0,
    Math.ceil((params.trialEndsAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  );

  // Determine effective status
  let effectiveStatus: CohortStatus = params.currentStatus;

  // If already ACTIVE, stay ACTIVE (activation is permanent)
  if (params.currentStatus === "ACTIVE" || params.activatedAt) {
    effectiveStatus = "ACTIVE";
  }
  // If paidCount >= threshold, should be ACTIVE
  else if (params.paidCount >= ACTIVATION_THRESHOLD) {
    effectiveStatus = "ACTIVE";
  }
  // If trial expired and not activated, should be LOCKED
  else if (isTrialExpired) {
    effectiveStatus = "LOCKED";
  }
  // Otherwise, still in TRIAL
  else {
    effectiveStatus = "TRIAL";
  }

  // Show activation counter only when paidCount >= 4
  const showActivationCounter = params.paidCount >= COUNTER_VISIBILITY_THRESHOLD;

  // Can submit if TRIAL or ACTIVE (not LOCKED)
  const canSubmit = effectiveStatus !== "LOCKED";

  return {
    status: effectiveStatus,
    trialEndsAt: params.trialEndsAt,
    activatedAt: params.activatedAt,
    paidCount: params.paidCount,
    memberCount: params.memberCount,
    isTrialExpired,
    daysUntilTrialEnd,
    showActivationCounter,
    canSubmit,
  };
}

/**
 * Check if a user has an active subscription
 */
export function isSubscriptionActive(subscription: {
  status: string;
  currentPeriodEnd: Date;
} | null): boolean {
  if (!subscription) return false;

  const now = new Date();
  return (
    subscription.status === "active" &&
    subscription.currentPeriodEnd > now
  );
}

/**
 * Compute trial end date from cohort creation date
 */
export function computeTrialEndDate(createdAt: Date): Date {
  const trialEndsAt = new Date(createdAt);
  trialEndsAt.setDate(trialEndsAt.getDate() + TRIAL_DAYS);
  return trialEndsAt;
}

/**
 * Format days remaining for display
 */
export function formatDaysRemaining(days: number): string {
  if (days === 0) return "Trial ends today";
  if (days === 1) return "1 day left in trial";
  return `${days} days left in trial`;
}

/**
 * Get activation counter text (only shown when paidCount >= 4)
 */
export function getActivationCounterText(paidCount: number): string | null {
  if (paidCount < COUNTER_VISIBILITY_THRESHOLD) {
    return null;
  }
  return `Activation: ${paidCount}/${ACTIVATION_THRESHOLD}`;
}
