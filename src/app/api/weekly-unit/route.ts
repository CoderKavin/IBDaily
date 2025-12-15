import { db } from "@/lib/db";
import { getSupabaseAdmin } from "@/lib/supabase";
import {
  withAuthGet,
  withAuth,
  success,
  errors,
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
  const supabase = getSupabaseAdmin();
  const subjectId = searchParams.get("subjectId");

  const currentWeekStart = getWeekStartDateKey();
  const previousWeekStart = getPreviousWeekStartDateKey(currentWeekStart);

  if (subjectId) {
    // Get selection for specific subject
    const { data: selection } = await supabase
      .from("weekly_unit_selections")
      .select("*, unit:units(*), subject:subjects(*)")
      .eq("user_id", session.user.id)
      .eq("subject_id", subjectId)
      .eq("week_start_date_key", currentWeekStart)
      .maybeSingle();

    // Carry-forward: if no selection this week, check last week
    if (!selection) {
      const { data: lastWeekSelection } = await supabase
        .from("weekly_unit_selections")
        .select("*, unit:units(*), subject:subjects(*)")
        .eq("user_id", session.user.id)
        .eq("subject_id", subjectId)
        .eq("week_start_date_key", previousWeekStart)
        .maybeSingle();

      if (lastWeekSelection && lastWeekSelection.unit) {
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
  const selections = await db.weeklyUnitSelections.findByUserAndWeek(
    session.user.id,
    currentWeekStart
  );

  // Get user's subjects to check which need carry-forward
  const userSubjects = await db.userSubjects.findByUser(session.user.id);

  // For subjects without current week selection, check last week
  const subjectsWithSelection = new Set(selections.map((s) => s.subject_id));
  const subjectsNeedingSelection = userSubjects.filter(
    (us) => us.subject?.has_units && !subjectsWithSelection.has(us.subject_id),
  );

  // Get last week's selections for subjects needing carry-forward
  const lastWeekSelections = await Promise.all(
    subjectsNeedingSelection.map(async (s) => {
      const { data } = await supabase
        .from("weekly_unit_selections")
        .select("*, unit:units(*), subject:subjects(*)")
        .eq("user_id", session.user.id)
        .eq("subject_id", s.subject_id)
        .eq("week_start_date_key", previousWeekStart)
        .maybeSingle();
      return data;
    })
  );

  // Build suggested units map
  const suggestedUnits = lastWeekSelections
    .filter((lws): lws is NonNullable<typeof lws> => lws !== null && lws.unit !== null && lws.subject !== null)
    .map((lws) => ({
      subjectId: lws.subject_id,
      subjectName: lws.subject?.transcript_name || 'Unknown',
      unitId: lws.unit?.id || '',
      unitName: lws.unit?.name || 'Unknown',
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
  const supabase = getSupabaseAdmin();
  const { subjectId, unitId } = body;

  if (!subjectId || !unitId) {
    return errors.validation("subjectId and unitId are required");
  }

  // Verify user has this subject
  const userSubjects = await db.userSubjects.findByUser(session.user.id);
  const userSubject = userSubjects.find((us) => us.subject_id === subjectId);

  if (!userSubject) {
    return errors.validation("You don't have this subject");
  }

  // Verify unit exists and belongs to subject
  const allUnits = await db.units.findBySubject(subjectId);
  const unit = allUnits.find((u) => {
    if (u.id !== unitId) return false;
    if (u.level_scope === "BOTH") return true;
    if (u.level_scope === "HL_ONLY" && userSubject.level === "HL") return true;
    if (u.level_scope === "SL_ONLY" && userSubject.level === "SL") return true;
    return false;
  });

  if (!unit) {
    return errors.validation("Invalid unit for this subject/level");
  }

  const currentWeekStart = getWeekStartDateKey();

  // Check if already set this week - ENFORCE ONCE PER WEEK
  const { data: existing } = await supabase
    .from("weekly_unit_selections")
    .select("*, unit:units(*)")
    .eq("user_id", session.user.id)
    .eq("subject_id", subjectId)
    .eq("week_start_date_key", currentWeekStart)
    .maybeSingle();

  if (existing) {
    const unitName = existing.unit?.name || 'a unit';
    return errors.validation(
      `You already selected "${unitName}" for this week. You can change it next week.`,
    );
  }

  // Create new selection
  await supabase.from("weekly_unit_selections").insert({
    user_id: session.user.id,
    subject_id: subjectId,
    unit_id: unitId,
    week_start_date_key: currentWeekStart,
  });

  return success({
    saved: true,
    weekStartDateKey: currentWeekStart,
  });
});
