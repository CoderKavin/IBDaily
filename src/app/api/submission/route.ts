import { prisma } from "@/lib/prisma";
import {
  withAuthGet,
  withAuth,
  success,
  errors,
  requireParam,
  throwError,
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
  const cohort = await prisma.cohort.findUnique({
    where: { id: cohortId },
    include: {
      members: {
        include: {
          user: {
            include: { subscription: true },
          },
        },
      },
    },
  });

  if (!cohort) {
    return { canSubmit: false, status: "LOCKED", reason: "Cohort not found" };
  }

  const now = new Date();
  const paidCount = cohort.members.filter((m) => {
    const sub = m.user.subscription;
    return sub && sub.status === "active" && sub.currentPeriodEnd > now;
  }).length;

  const statusInfo = computeCohortStatus({
    currentStatus: cohort.status as CohortStatus,
    trialEndsAt: cohort.trialEndsAt,
    activatedAt: cohort.activatedAt,
    paidCount,
    memberCount: cohort.members.length,
  });

  // Update cohort status in DB if it changed
  if (statusInfo.status !== cohort.status) {
    await prisma.cohort.update({
      where: { id: cohortId },
      data: {
        status: statusInfo.status,
        activatedAt:
          statusInfo.status === "ACTIVE" && !cohort.activatedAt
            ? new Date()
            : cohort.activatedAt,
      },
    });
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
  const membership = await prisma.cohortMember.findUnique({
    where: {
      userId_cohortId: {
        userId: session.user.id,
        cohortId,
      },
    },
  });

  if (!membership) {
    return errors.notMember();
  }

  // Check cohort status
  const cohortCheck = await checkCohortCanSubmit(cohortId);

  const todayKey = getIndiaDateKey();

  const submission = await prisma.submission.findUnique({
    where: {
      userId_cohortId_dateKey: {
        userId: session.user.id,
        cohortId,
        dateKey: todayKey,
      },
    },
  });

  // Get user's subjects for dropdown
  const userSubjects = await prisma.userSubject.findMany({
    where: { userId: session.user.id },
    include: { subject: true },
    orderBy: { subject: { groupNumber: "asc" } },
  });

  // Format subjects for dropdown: "Subject Name (SL/HL)"
  const subjects = userSubjects.map((us) => ({
    id: us.subject.id,
    label: `${us.subject.transcriptName} ${us.level}`,
    fullName: us.subject.fullName,
    level: us.level,
    hasUnits: us.subject.hasUnits,
  }));

  // Check if user needs onboarding
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { onboardingCompleted: true },
  });

  return success({
    submission,
    subjects,
    todayKey,
    needsOnboarding: !user?.onboardingCompleted || subjects.length === 0,
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

  if (!cohortId || !subjectId || !bullet1 || !bullet2 || !bullet3) {
    return errors.validation("All fields are required");
  }

  const bullets = [bullet1, bullet2, bullet3];
  const todayKey = getIndiaDateKey();

  // Get yesterday's submission for similarity check
  const yesterdayKey = getYesterdayIndiaDateKey();
  const yesterdaySubmission = await prisma.submission.findUnique({
    where: {
      userId_cohortId_dateKey: {
        userId: session.user.id,
        cohortId,
        dateKey: yesterdayKey,
      },
    },
    select: { bullet1: true, bullet2: true, bullet3: true },
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
  const membership = await prisma.cohortMember.findUnique({
    where: {
      userId_cohortId: {
        userId: session.user.id,
        cohortId,
      },
    },
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
  const userSubject = await prisma.userSubject.findUnique({
    where: {
      userId_subjectId: { userId: session.user.id, subjectId },
    },
    include: { subject: true },
  });

  if (!userSubject) {
    return errors.validation("You don't have this subject selected");
  }

  const subjectDisplayName = `${userSubject.subject.transcriptName} ${userSubject.level}`;

  // Upsert submission with quality status
  const submission = await prisma.submission.upsert({
    where: {
      userId_cohortId_dateKey: {
        userId: session.user.id,
        cohortId,
        dateKey: todayKey,
      },
    },
    update: {
      subjectId,
      subject: subjectDisplayName,
      bullet1,
      bullet2,
      bullet3,
      qualityStatus: qualityResult.status,
      qualityReasons: JSON.stringify(qualityResult.reasons),
      createdAt: new Date(),
    },
    create: {
      userId: session.user.id,
      cohortId,
      dateKey: todayKey,
      subjectId,
      subject: subjectDisplayName,
      bullet1,
      bullet2,
      bullet3,
      qualityStatus: qualityResult.status,
      qualityReasons: JSON.stringify(qualityResult.reasons),
    },
  });

  return success({
    submission,
    qualityStatus: qualityResult.status,
    qualityReasons: qualityResult.reasons,
  });
});
