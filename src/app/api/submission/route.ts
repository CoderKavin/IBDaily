import { db } from "@/lib/db";
import { getSupabaseAdmin } from "@/lib/supabase";
import {
  withAuthGet,
  withAuth,
  success,
  errors,
  requireParam,
} from "@/lib/api-utils";
import { getIndiaDateKey, getYesterdayIndiaDateKey } from "@/lib/timezone";
import { computeCohortStatus, type CohortStatus } from "@/lib/cohort-status";
import { checkSubmissionQuality } from "@/lib/quality-check";

/**
 * Check if cohort allows submissions (not LOCKED)
 */
async function checkCohortCanSubmit(cohortId: string): Promise<{
  canSubmit: boolean;
  status: CohortStatus;
  reason?: string;
}> {
  const supabase = getSupabaseAdmin();

  const { data: cohort, error } = await supabase
    .from("cohorts")
    .select("*")
    .eq("id", cohortId)
    .maybeSingle();

  if (error || !cohort) {
    return { canSubmit: false, status: "LOCKED", reason: "Cohort not found" };
  }

  const members = await db.cohortMembers.findByCohort(cohortId);
  const now = new Date();

  let paidCount = 0;
  for (const member of members) {
    const sub = await db.subscriptions.findByUser(member.user_id);
    if (sub && sub.status === "active" && new Date(sub.current_period_end) > now) {
      paidCount++;
    }
  }

  const statusInfo = computeCohortStatus({
    currentStatus: cohort.status as CohortStatus,
    trialEndsAt: new Date(cohort.trial_ends_at),
    activatedAt: cohort.activated_at ? new Date(cohort.activated_at) : null,
    paidCount,
    memberCount: members.length,
  });

  // Update cohort status in DB if it changed
  if (statusInfo.status !== cohort.status) {
    await supabase
      .from("cohorts")
      .update({
        status: statusInfo.status,
        activated_at:
          statusInfo.status === "ACTIVE" && !cohort.activated_at
            ? new Date().toISOString()
            : cohort.activated_at,
      })
      .eq("id", cohortId);
  }

  if (!statusInfo.canSubmit) {
    return {
      canSubmit: false,
      status: statusInfo.status,
      reason: "Trial has ended. Activate membership to continue submitting.",
    };
  }

  return { canSubmit: true, status: statusInfo.status };
}

// GET - get today's submission for a cohort
export const GET = withAuthGet(async ({ session, searchParams }) => {
  const cohortId = requireParam(searchParams, "cohortId");

  // Verify membership
  const membership = await db.cohortMembers.findUnique({
    user_id: session.user.id,
    cohort_id: cohortId,
  });

  if (!membership) {
    return errors.notMember();
  }

  // Check cohort status
  const cohortCheck = await checkCohortCanSubmit(cohortId);

  const todayKey = getIndiaDateKey();

  const submission = await db.submissions.findUnique({
    user_id: session.user.id,
    cohort_id: cohortId,
    date_key: todayKey,
  });

  // Get user's subjects for dropdown
  const userSubjects = await db.userSubjects.findByUser(session.user.id);

  // Format subjects for dropdown: "Subject Name (SL/HL)"
  const subjects = userSubjects.map((us) => ({
    id: us.subject?.id || us.subject_id,
    label: `${us.subject?.transcript_name || 'Unknown'} ${us.level}`,
    fullName: us.subject?.full_name || '',
    level: us.level,
    hasUnits: us.subject?.has_units || false,
  }));

  // Check if user needs onboarding
  const user = await db.users.findUnique({ id: session.user.id });

  return success({
    submission,
    subjects,
    todayKey,
    needsOnboarding: !user?.onboarding_completed || subjects.length === 0,
    cohortStatus: cohortCheck.status,
    canSubmit: cohortCheck.canSubmit,
    lockReason: cohortCheck.reason,
  });
});

// POST - create or update today's submission
export const POST = withAuth<{
  cohortId: string;
  subjectId: string;
  bullet1: string;
  bullet2: string;
  bullet3: string;
}>(async ({ session, body }) => {
  const { cohortId, subjectId, bullet1, bullet2, bullet3 } = body;

  if (!cohortId || !subjectId) {
    return errors.validation("Cohort and subject are required");
  }

  if (!bullet1 && !bullet2 && !bullet3) {
    return errors.validation("At least one bullet point is required");
  }

  const bullets = [bullet1 || "", bullet2 || "", bullet3 || ""];
  const todayKey = getIndiaDateKey();

  // Get yesterday's submission for similarity check
  const yesterdayKey = getYesterdayIndiaDateKey();
  const yesterdaySubmission = await db.submissions.findUnique({
    user_id: session.user.id,
    cohort_id: cohortId,
    date_key: yesterdayKey,
  });

  const yesterdayBullets = yesterdaySubmission
    ? [
        yesterdaySubmission.bullet1,
        yesterdaySubmission.bullet2,
        yesterdaySubmission.bullet3,
      ]
    : undefined;

  // Run quality check
  const qualityResult = checkSubmissionQuality(bullets, yesterdayBullets);

  // Block submission if validation errors (hard requirements)
  if (qualityResult.validationErrors.length > 0) {
    return errors.validation(
      "Submission does not meet requirements",
      qualityResult.validationErrors,
    );
  }

  // Verify membership
  const membership = await db.cohortMembers.findUnique({
    user_id: session.user.id,
    cohort_id: cohortId,
  });

  if (!membership) {
    return errors.notMember();
  }

  // Check if cohort allows submissions
  const cohortCheck = await checkCohortCanSubmit(cohortId);

  if (!cohortCheck.canSubmit) {
    return errors.cohortLocked(cohortCheck.reason);
  }

  // Verify user has this subject and get display name
  const userSubjects = await db.userSubjects.findByUser(session.user.id);
  const userSubject = userSubjects.find((us) => us.subject_id === subjectId);

  if (!userSubject) {
    return errors.validation("You don't have this subject selected");
  }

  const subjectDisplayName = `${userSubject.subject?.transcript_name || 'Unknown'} ${userSubject.level}`;

  // Upsert submission with quality status
  const submission = await db.submissions.upsert(
    {
      user_id: session.user.id,
      cohort_id: cohortId,
      date_key: todayKey,
    },
    {
      subject_id: subjectId,
      subject: subjectDisplayName,
      bullet1: bullet1 || "",
      bullet2: bullet2 || "",
      bullet3: bullet3 || "",
      quality_status: qualityResult.status,
      quality_reasons: JSON.stringify(qualityResult.reasons),
    }
  );

  return success({
    submission,
    qualityStatus: qualityResult.status,
    qualityReasons: qualityResult.reasons,
  });
});
