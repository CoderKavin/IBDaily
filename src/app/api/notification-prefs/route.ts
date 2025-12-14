import { db } from "@/lib/db";
import { withAuthGet, withAuth, success, errors } from "@/lib/api-utils";

// GET - Retrieve current notification preferences
export const GET = withAuthGet(async ({ session }) => {
  const prefs = await db.notificationPrefs.findByUser(session.user.id);

  // Return defaults if no prefs exist
  if (!prefs) {
    return success({
      isEnabled: true,
      remindTimeMinutesBeforeCutoff: 90,
      lastCallMinutesBeforeCutoff: 15,
      quietHoursStart: null,
      quietHoursEnd: null,
    });
  }

  return success({
    isEnabled: prefs.is_enabled,
    remindTimeMinutesBeforeCutoff: prefs.remind_time_minutes_before_cutoff,
    lastCallMinutesBeforeCutoff: prefs.last_call_minutes_before_cutoff,
    quietHoursStart: prefs.quiet_hours_start,
    quietHoursEnd: prefs.quiet_hours_end,
  });
});

// PUT - Update notification preferences
export const PUT = withAuth<{
  isEnabled?: boolean;
  remindTimeMinutesBeforeCutoff?: number;
  lastCallMinutesBeforeCutoff?: number;
  quietHoursStart?: number | null;
  quietHoursEnd?: number | null;
}>(async ({ session, body }) => {
  const {
    isEnabled,
    remindTimeMinutesBeforeCutoff,
    lastCallMinutesBeforeCutoff,
    quietHoursStart,
    quietHoursEnd,
  } = body;

  // Validate quiet hours - both must be set or both null
  if (
    (quietHoursStart !== null && quietHoursStart !== undefined && (quietHoursEnd === null || quietHoursEnd === undefined)) ||
    (quietHoursEnd !== null && quietHoursEnd !== undefined && (quietHoursStart === null || quietHoursStart === undefined))
  ) {
    return errors.validation(
      "Both quiet hours start and end must be set, or both must be null",
    );
  }

  // Build update data
  const updateData: Record<string, unknown> = {};
  if (isEnabled !== undefined) updateData.is_enabled = isEnabled;
  if (remindTimeMinutesBeforeCutoff !== undefined) {
    updateData.remind_time_minutes_before_cutoff = remindTimeMinutesBeforeCutoff;
  }
  if (lastCallMinutesBeforeCutoff !== undefined) {
    updateData.last_call_minutes_before_cutoff = lastCallMinutesBeforeCutoff;
  }
  if (quietHoursStart !== undefined) updateData.quiet_hours_start = quietHoursStart;
  if (quietHoursEnd !== undefined) updateData.quiet_hours_end = quietHoursEnd;

  // Upsert preferences
  const prefs = await db.notificationPrefs.upsert(session.user.id, updateData);

  return success({
    isEnabled: prefs.is_enabled,
    remindTimeMinutesBeforeCutoff: prefs.remind_time_minutes_before_cutoff,
    lastCallMinutesBeforeCutoff: prefs.last_call_minutes_before_cutoff,
    quietHoursStart: prefs.quiet_hours_start,
    quietHoursEnd: prefs.quiet_hours_end,
  });
});
