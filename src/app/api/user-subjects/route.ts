import { prisma } from "@/lib/prisma";
import {
  withAuthGet,
  withAuth,
  success,
  errors,
  throwError,
} from "@/lib/api-utils";

const MIN_SUBJECTS = 3;
const MAX_SUBJECTS = 6;

// GET - get user's selected subjects
export const GET = withAuthGet(async ({ session }) => {
  const userSubjects = await prisma.userSubject.findMany({
    where: { userId: session.user.id },
    include: {
      subject: {
        include: {
          units: {
            orderBy: { orderIndex: "asc" },
          },
        },
      },
    },
    orderBy: { subject: { groupNumber: "asc" } },
  });

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { onboardingCompleted: true },
  });

  return success({
    userSubjects,
    onboardingCompleted: user?.onboardingCompleted ?? false,
    minSubjects: MIN_SUBJECTS,
    maxSubjects: MAX_SUBJECTS,
  });
});

// POST - save user's subject selections (onboarding)
export const POST = withAuth<{
  selections: Array<{ subjectId: string; level: string }>;
}>(async ({ session, body }) => {
  const { selections } = body;

  if (!Array.isArray(selections)) {
    return errors.validation("Invalid selections format");
  }

  // Enforce 3-6 subjects
  if (selections.length < MIN_SUBJECTS) {
    return errors.validation(
      `You must select at least ${MIN_SUBJECTS} subjects`,
    );
  }

  if (selections.length > MAX_SUBJECTS) {
    return errors.validation(`You can select at most ${MAX_SUBJECTS} subjects`);
  }

  // Validate selections
  for (const sel of selections) {
    if (!sel.subjectId || !sel.level) {
      return errors.validation("Each selection needs subjectId and level");
    }
    if (!["SL", "HL"].includes(sel.level)) {
      return errors.validation("Level must be SL or HL");
    }
  }

  // Check for duplicate subjects
  const subjectIds = selections.map((s) => s.subjectId);
  if (new Set(subjectIds).size !== subjectIds.length) {
    return errors.validation("Duplicate subjects not allowed");
  }

  // Verify all subjects exist and level is allowed
  const subjects = await prisma.subject.findMany({
    where: { id: { in: subjectIds } },
  });

  const subjectMap = new Map(subjects.map((s) => [s.id, s]));

  for (const sel of selections) {
    const subject = subjectMap.get(sel.subjectId);
    if (!subject) {
      return errors.notFound(`Subject ${sel.subjectId} not found`);
    }
    if (sel.level === "HL" && !subject.hlAvailable) {
      return errors.validation(`${subject.fullName} is not available at HL`);
    }
    if (sel.level === "SL" && !subject.slAvailable) {
      return errors.validation(`${subject.fullName} is not available at SL`);
    }
  }

  // Delete existing selections and create new ones
  await prisma.$transaction(async (tx) => {
    await tx.userSubject.deleteMany({
      where: { userId: session.user.id },
    });

    await tx.userSubject.createMany({
      data: selections.map((sel) => ({
        userId: session.user.id,
        subjectId: sel.subjectId,
        level: sel.level,
      })),
    });

    await tx.user.update({
      where: { id: session.user.id },
      data: { onboardingCompleted: true },
    });
  });

  return success({ saved: true });
});
