import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  sendEmail,
  generateReminderEmail,
  isEmailConfigured,
} from "@/lib/email";
import {
  getTodayDateKeyIST,
  shouldSendReminder,
  getMinutesUntilDeadline,
  type ReminderType,
} from "@/lib/reminder-logic";

// Verify cron secret to prevent unauthorized access
function verifyCronSecret(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    // Allow in development without secret
    return process.env.NODE_ENV === "development";
  }

  const authHeader = request.headers.get("authorization");
  if (!authHeader) return false;

  const [type, token] = authHeader.split(" ");
  return type === "Bearer" && token === cronSecret;
}

interface ReminderCandidate {
  userId: string;
  email: string;
  userName: string | null;
  cohortId: string;
  cohortName: string;
  prefs: {
    isEnabled: boolean;
    remindTimeMinutesBeforeCutoff: number;
    lastCallMinutesBeforeCutoff: number;
    quietHoursStart: number | null;
    quietHoursEnd: number | null;
  };
}

export async function POST(request: NextRequest) {
  // Verify authorization
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check if email is configured
  if (!isEmailConfigured()) {
    return NextResponse.json({
      success: true,
      message: "Email not configured, skipping reminders",
      sent: 0,
    });
  }

  const dateKey = getTodayDateKeyIST();
  const minutesLeft = getMinutesUntilDeadline();

  // If past deadline, no reminders needed
  if (minutesLeft <= 0) {
    return NextResponse.json({
      success: true,
      message: "Past deadline, no reminders needed",
      sent: 0,
    });
  }

  try {
    // Find all users in ACTIVE or TRIAL cohorts who haven't submitted today
    // Join with notification preferences
    const candidates = await prisma.$queryRaw<ReminderCandidate[]>`
      SELECT
        u.id as userId,
        u.email,
        u.name as userName,
        c.id as cohortId,
        c.name as cohortName,
        COALESCE(np.isEnabled, 1) as "prefs.isEnabled",
        COALESCE(np.remindTimeMinutesBeforeCutoff, 90) as "prefs.remindTimeMinutesBeforeCutoff",
        COALESCE(np.lastCallMinutesBeforeCutoff, 15) as "prefs.lastCallMinutesBeforeCutoff",
        np.quietHoursStart as "prefs.quietHoursStart",
        np.quietHoursEnd as "prefs.quietHoursEnd"
      FROM User u
      INNER JOIN CohortMember cm ON cm.userId = u.id
      INNER JOIN Cohort c ON c.id = cm.cohortId
      LEFT JOIN NotificationPrefs np ON np.userId = u.id
      WHERE c.status IN ('ACTIVE', 'TRIAL')
        AND NOT EXISTS (
          SELECT 1 FROM Submission s
          WHERE s.userId = u.id
            AND s.cohortId = c.id
            AND s.dateKey = ${dateKey}
        )
    `;

    // Transform raw results to proper structure
    const processedCandidates: ReminderCandidate[] = candidates.map((row) => {
      const rawRow = row as unknown as Record<string, unknown>;
      return {
        userId: rawRow.userId as string,
        email: rawRow.email as string,
        userName: rawRow.userName as string | null,
        cohortId: rawRow.cohortId as string,
        cohortName: rawRow.cohortName as string,
        prefs: {
          isEnabled: Boolean(rawRow["prefs.isEnabled"]),
          remindTimeMinutesBeforeCutoff:
            Number(rawRow["prefs.remindTimeMinutesBeforeCutoff"]) || 90,
          lastCallMinutesBeforeCutoff:
            Number(rawRow["prefs.lastCallMinutesBeforeCutoff"]) || 15,
          quietHoursStart: rawRow["prefs.quietHoursStart"] as number | null,
          quietHoursEnd: rawRow["prefs.quietHoursEnd"] as number | null,
        },
      };
    });

    // Get existing reminder logs for today
    const existingLogs = await prisma.reminderLog.findMany({
      where: { dateKey },
      select: {
        userId: true,
        cohortId: true,
        type: true,
      },
    });

    // Build a set for quick lookup
    const sentSet = new Set(
      existingLogs.map((log) => `${log.userId}:${log.cohortId}:${log.type}`),
    );

    // Process each candidate
    const results: {
      userId: string;
      cohortId: string;
      type: ReminderType;
      success: boolean;
    }[] = [];

    for (const candidate of processedCandidates) {
      const alreadySentRemind = sentSet.has(
        `${candidate.userId}:${candidate.cohortId}:REMIND`,
      );
      const alreadySentLastCall = sentSet.has(
        `${candidate.userId}:${candidate.cohortId}:LAST_CALL`,
      );

      const reminderType = shouldSendReminder({
        hasSubmittedToday: false, // We already filtered these out
        prefsEnabled: candidate.prefs.isEnabled,
        remindTimeMinutes: candidate.prefs.remindTimeMinutesBeforeCutoff,
        lastCallMinutes: candidate.prefs.lastCallMinutesBeforeCutoff,
        quietHoursStart: candidate.prefs.quietHoursStart,
        quietHoursEnd: candidate.prefs.quietHoursEnd,
        alreadySentRemind,
        alreadySentLastCall,
      });

      if (!reminderType) {
        continue;
      }

      // Generate and send email
      const emailContent = generateReminderEmail({
        userName: candidate.userName || "there",
        cohortName: candidate.cohortName,
        minutesLeft: getMinutesUntilDeadline(),
        isLastCall: reminderType === "LAST_CALL",
      });

      const emailResult = await sendEmail({
        to: candidate.email,
        subject: emailContent.subject,
        html: emailContent.html,
        text: emailContent.text,
      });

      if (emailResult.success) {
        // Log the reminder (idempotency key)
        try {
          await prisma.reminderLog.create({
            data: {
              userId: candidate.userId,
              cohortId: candidate.cohortId,
              dateKey,
              type: reminderType,
            },
          });
        } catch {
          // Unique constraint violation means it was already sent
          // This is fine, skip
          console.log(
            `Reminder already logged for ${candidate.userId}:${candidate.cohortId}:${reminderType}`,
          );
        }
      }

      results.push({
        userId: candidate.userId,
        cohortId: candidate.cohortId,
        type: reminderType,
        success: emailResult.success,
      });
    }

    const sentCount = results.filter((r) => r.success).length;

    return NextResponse.json({
      success: true,
      dateKey,
      minutesUntilDeadline: minutesLeft,
      candidatesFound: processedCandidates.length,
      sent: sentCount,
      results,
    });
  } catch (error) {
    console.error("Error sending reminders:", error);
    return NextResponse.json(
      { error: "Failed to send reminders" },
      { status: 500 },
    );
  }
}

// Also allow GET for easy testing in development
export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
  }

  return POST(request);
}
