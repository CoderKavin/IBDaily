import { prisma } from "@/lib/prisma";
import { withAuthGet, withAuth, success, errors } from "@/lib/api-utils";
import { z } from "zod";

const updatePrefsSchema = z.object({
  isEnabled: z.boolean().optional(),
  remindTimeMinutesBeforeCutoff: z.number().int().min(10).max(180).optional(),
  lastCallMinutesBeforeCutoff: z.number().int().min(5).max(60).optional(),
  quietHoursStart: z.number().int().min(0).max(23).nullable().optional(),
  quietHoursEnd: z.number().int().min(0).max(23).nullable().optional(),
});

// GET - Retrieve current notification preferences
export const GET = withAuthGet(async ({ session }) => {
  const prefs = await prisma.notificationPrefs.findUnique({
    where: { userId: session.user.id },
  });

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
    isEnabled: prefs.isEnabled,
    remindTimeMinutesBeforeCutoff: prefs.remindTimeMinutesBeforeCutoff,
    lastCallMinutesBeforeCutoff: prefs.lastCallMinutesBeforeCutoff,
    quietHoursStart: prefs.quietHoursStart,
    quietHoursEnd: prefs.quietHoursEnd,
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
  const parseResult = updatePrefsSchema.safeParse(body);

  if (!parseResult.success) {
    return errors.validation("Invalid request data", parseResult.error.issues);
  }

  const parsed = parseResult.data;

  // Validate quiet hours - both must be set or both null
  if (
    (parsed.quietHoursStart !== null && parsed.quietHoursEnd === null) ||
    (parsed.quietHoursStart === null && parsed.quietHoursEnd !== null)
  ) {
    return errors.validation(
      "Both quiet hours start and end must be set, or both must be null",
    );
  }

  // Upsert preferences
  const prefs = await prisma.notificationPrefs.upsert({
    where: { userId: session.user.id },
    update: {
      ...(parsed.isEnabled !== undefined && { isEnabled: parsed.isEnabled }),
      ...(parsed.remindTimeMinutesBeforeCutoff !== undefined && {
        remindTimeMinutesBeforeCutoff: parsed.remindTimeMinutesBeforeCutoff,
      }),
      ...(parsed.lastCallMinutesBeforeCutoff !== undefined && {
        lastCallMinutesBeforeCutoff: parsed.lastCallMinutesBeforeCutoff,
      }),
      ...(parsed.quietHoursStart !== undefined && {
        quietHoursStart: parsed.quietHoursStart,
      }),
      ...(parsed.quietHoursEnd !== undefined && {
        quietHoursEnd: parsed.quietHoursEnd,
      }),
    },
    create: {
      userId: session.user.id,
      isEnabled: parsed.isEnabled ?? true,
      remindTimeMinutesBeforeCutoff: parsed.remindTimeMinutesBeforeCutoff ?? 90,
      lastCallMinutesBeforeCutoff: parsed.lastCallMinutesBeforeCutoff ?? 15,
      quietHoursStart: parsed.quietHoursStart ?? null,
      quietHoursEnd: parsed.quietHoursEnd ?? null,
    },
  });

  return success({
    isEnabled: prefs.isEnabled,
    remindTimeMinutesBeforeCutoff: prefs.remindTimeMinutesBeforeCutoff,
    lastCallMinutesBeforeCutoff: prefs.lastCallMinutesBeforeCutoff,
    quietHoursStart: prefs.quietHoursStart,
    quietHoursEnd: prefs.quietHoursEnd,
  });
});
