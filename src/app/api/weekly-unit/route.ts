import { prisma } from "@/lib/prisma";
import {
  withAuthGet,
  withAuth,
  success,
  errors,
  requireParam,
} from "@/lib/api-utils";
import { getWeekStartDateKey } from "@/lib/timezone";

/**
 * Get the previous week's start date key
 */
function getPreviousWeekStartDateKey(currentWeekStart: string): string {
  const [year, month, day] = currentWeekStart.split("-").map(Number);
  const date = new Date(year, month - 1, day - 7);
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(date);
}

// GET - get current week's unit selections
export const GET = withAuthGet(async ({ session, searchParams }) => {
  const subjectId = searchParams.get("subjectId");

  const currentWeekStart = getWeekStartDateKey();
  const previousWeekStart = getPreviousWeekStartDateKey(currentWeekStart);

  if (subjectId) {
    // Get selection for specific subject
    const selection = await prisma.weeklyUnitSelection.findUnique({
      where: {
        userId_subjectId_weekStartDateKey: {
          userId: session.user.id,
          subjectId,
          weekStartDateKey: currentWeekStart,
        },
      },
      include: { unit: true, subject: true },
    });

    // Carry-forward: if no selection this week, check last week
    if (!selection) {
      const lastWeekSelection = await prisma.weeklyUnitSelection.findUnique({
        where: {
          userId_subjectId_weekStartDateKey: {
            userId: session.user.id,
            subjectId,
            weekStartDateKey: previousWeekStart,
          },
        },
        include: { unit: true, subject: true },
      });

      if (lastWeekSelection) {
        // Return last week's selection as suggestion (not yet committed)
        return success({
          selection: null,
          suggestedUnit: {
            id: lastWeekSelection.unit.id,
            name: lastWeekSelection.unit.name,
            fromLastWeek: true,
          },
          weekStartDateKey: currentWeekStart,
          carriedForward: true,
        });
      }
    }

    return success({
      selection,
      weekStartDateKey: currentWeekStart,
      carriedForward: false,
    });
  }

  // Get all selections for current week
  const selections = await prisma.weeklyUnitSelection.findMany({
    where: {
      userId: session.user.id,
      weekStartDateKey: currentWeekStart,
    },
    include: { unit: true, subject: true },
  });

  // Get user's subjects to check which need carry-forward
  const userSubjects = await prisma.userSubject.findMany({
    where: { userId: session.user.id },
    include: { subject: true },
  });

  // For subjects without current week selection, check last week
  const subjectsWithSelection = new Set(selections.map((s) => s.subjectId));
  const subjectsNeedingSelection = userSubjects.filter(
    (us) => us.subject.hasUnits && !subjectsWithSelection.has(us.subjectId),
  );

  // Get last week's selections for subjects needing carry-forward
  const lastWeekSelections = await prisma.weeklyUnitSelection.findMany({
    where: {
      userId: session.user.id,
      weekStartDateKey: previousWeekStart,
      subjectId: { in: subjectsNeedingSelection.map((s) => s.subjectId) },
    },
    include: { unit: true, subject: true },
  });

  // Build suggested units map
  const suggestedUnits = lastWeekSelections.map((lws) => ({
    subjectId: lws.subjectId,
    subjectName: lws.subject.transcriptName,
    unitId: lws.unit.id,
    unitName: lws.unit.name,
    fromLastWeek: true,
  }));

  return success({
    selections,
    suggestedUnits,
    weekStartDateKey: currentWeekStart,
  });
});

// POST - set weekly unit for a subject (once per week only)
export const POST = withAuth<{
  subjectId: string;
  unitId: string;
}>(async ({ session, body }) => {
  const { subjectId, unitId } = body;

  if (!subjectId || !unitId) {
    return errors.validation("subjectId and unitId are required");
  }

  // Verify user has this subject
  const userSubject = await prisma.userSubject.findUnique({
    where: {
      userId_subjectId: { userId: session.user.id, subjectId },
    },
  });

  if (!userSubject) {
    return errors.validation("You don't have this subject");
  }

  // Verify unit exists and belongs to subject
  const unit = await prisma.unit.findFirst({
    where: {
      id: unitId,
      subjectId,
      OR: [
        { levelScope: "BOTH" },
        { levelScope: userSubject.level === "HL" ? "HL_ONLY" : "SL_ONLY" },
      ],
    },
  });

  if (!unit) {
    return errors.validation("Invalid unit for this subject/level");
  }

  const currentWeekStart = getWeekStartDateKey();

  // Check if already set this week - ENFORCE ONCE PER WEEK
  const existing = await prisma.weeklyUnitSelection.findUnique({
    where: {
      userId_subjectId_weekStartDateKey: {
        userId: session.user.id,
        subjectId,
        weekStartDateKey: currentWeekStart,
      },
    },
    include: { unit: true },
  });

  if (existing) {
    // Already set this week - do not allow change
    return errors.validation(
      `You already selected "${existing.unit.name}" for this week. You can change it next week.`,
    );
  }

  // Create new selection
  await prisma.weeklyUnitSelection.create({
    data: {
      userId: session.user.id,
      subjectId,
      unitId,
      weekStartDateKey: currentWeekStart,
    },
  });

  return success({
    saved: true,
    weekStartDateKey: currentWeekStart,
  });
});
