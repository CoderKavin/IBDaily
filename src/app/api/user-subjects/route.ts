import { db } from "@/lib/db";
import { supabaseAdmin } from "@/lib/supabase";
import {
  withAuthGet,
  withAuth,
  success,
  errors,
} from "@/lib/api-utils";

const MIN_SUBJECTS = 3;
const MAX_SUBJECTS = 6;

// GET - get user's selected subjects
export const GET = withAuthGet(async ({ session }) => {
  const userSubjects = await db.userSubjects.findByUser(session.user.id);

  // Get units for each subject
  const userSubjectsWithUnits = await Promise.all(
    userSubjects.map(async (us) => {
      const units = await db.units.findBySubject(us.subject_id);
      return {
        ...us,
        subject: {
          ...us.subject,
          units,
        },
      };
    })
  );

  const user = await db.users.findUnique({ id: session.user.id });

  return success({
    userSubjects: userSubjectsWithUnits,
    onboardingCompleted: user?.onboarding_completed ?? false,
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
  const allSubjects = await db.subjects.findAll();
  const subjectMap = new Map(allSubjects.map((s) => [s.id, s]));

  for (const sel of selections) {
    const subject = subjectMap.get(sel.subjectId);
    if (!subject) {
      return errors.notFound(`Subject ${sel.subjectId} not found`);
    }
    if (sel.level === "HL" && !subject.hl_available) {
      return errors.validation(`${subject.full_name} is not available at HL`);
    }
    if (sel.level === "SL" && !subject.sl_available) {
      return errors.validation(`${subject.full_name} is not available at SL`);
    }
  }

  // Delete existing selections
  await db.userSubjects.deleteByUser(session.user.id);

  // Create new selections
  for (const sel of selections) {
    await db.userSubjects.create({
      user_id: session.user.id,
      subject_id: sel.subjectId,
      level: sel.level,
    });
  }

  // Mark onboarding complete
  await db.users.update(session.user.id, { onboarding_completed: true });

  return success({ saved: true });
});
