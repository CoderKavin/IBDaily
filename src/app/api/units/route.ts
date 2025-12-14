import { db } from "@/lib/db";
import { withAuthGet, success, errors, requireParam } from "@/lib/api-utils";

// GET - get units for a subject
export const GET = withAuthGet(async ({ session, searchParams }) => {
  const subjectId = requireParam(searchParams, "subjectId");

  // Verify user has this subject
  const userSubjects = await db.userSubjects.findByUser(session.user.id);
  const userSubject = userSubjects.find((us) => us.subject_id === subjectId);

  if (!userSubject) {
    return errors.validation("You don't have this subject");
  }

  const allUnits = await db.units.findBySubject(subjectId);

  // Filter units based on level scope
  const units = allUnits.filter((unit) => {
    if (unit.level_scope === "BOTH") return true;
    if (unit.level_scope === "HL_ONLY" && userSubject.level === "HL") return true;
    if (unit.level_scope === "SL_ONLY" && userSubject.level === "SL") return true;
    return false;
  });

  return success({ units, level: userSubject.level });
});
