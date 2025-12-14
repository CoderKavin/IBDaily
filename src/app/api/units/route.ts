import { prisma } from "@/lib/prisma";
import { withAuthGet, success, errors, requireParam } from "@/lib/api-utils";

// GET - get units for a subject
export const GET = withAuthGet(async ({ session, searchParams }) => {
  const subjectId = requireParam(searchParams, "subjectId");

  // Verify user has this subject
  const userSubject = await prisma.userSubject.findUnique({
    where: {
      userId_subjectId: { userId: session.user.id, subjectId },
    },
  });

  if (!userSubject) {
    return errors.validation("You don't have this subject");
  }

  const units = await prisma.unit.findMany({
    where: {
      subjectId,
      OR: [
        { levelScope: "BOTH" },
        { levelScope: userSubject.level === "HL" ? "HL_ONLY" : "SL_ONLY" },
      ],
    },
    orderBy: { orderIndex: "asc" },
  });

  return success({ units, level: userSubject.level });
});
