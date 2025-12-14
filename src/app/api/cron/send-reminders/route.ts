import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { db } from "@/lib/db";
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
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isEmailConfigured()) {
    return NextResponse.json({
      success: true,
      message: "Email not configured, skipping reminders",
      sent: 0,
    });
  }

  const dateKey = getTodayDateKeyIST();
  const minutesLeft = getMinutesUntilDeadline();

  if (minutesLeft <= 0) {
    return NextResponse.json({
      success: true,
      message: "Past deadline, no reminders needed",
      sent: 0,
    });
  }

  try {
    // Get active cohorts
    const { data: cohorts } = await supabaseAdmin
      .from("cohorts")
      .select("id, name")
      .in("status", ["ACTIVE", "TRIAL"]);

    if (!cohorts || cohorts.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No active cohorts",
        sent: 0,
      });
    }

    const candidates: ReminderCandidate[] = [];

    // For each cohort, find members who haven't submitted today
    for (const cohort of cohorts) {
      const members = await db.cohortMembers.findByCohort(cohort.id);

      for (const member of members) {
        // Check if already submitted today
        const submission = await db.submissions.findUnique({
          user_id: member.user_id,
          cohort_id: cohort.id,
          date_key: dateKey,
        });

        if (submission) continue;

        // Get notification prefs
        const prefs = await db.notificationPrefs.findByUser(member.user_id);

        candidates.push({
          userId: member.user_id,
          email: member.user?.email || "",
          userName: member.user?.name || null,
          cohortId: cohort.id,
          cohortName: cohort.name,
          prefs: {
            isEnabled: prefs?.is_enabled ?? true,
            remindTimeMinutesBeforeCutoff: prefs?.remind_time_minutes_before_cutoff ?? 90,
            lastCallMinutesBeforeCutoff: prefs?.last_call_minutes_before_cutoff ?? 15,
            quietHoursStart: prefs?.quiet_hours_start ?? null,
            quietHoursEnd: prefs?.quiet_hours_end ?? null,
          },
        });
      }
    }

    // Get existing reminder logs for today
    const { data: existingLogs } = await supabaseAdmin
      .from("reminder_logs")
      .select("user_id, cohort_id, type")
      .eq("date_key", dateKey);

    const sentSet = new Set(
      (existingLogs || []).map((log) => `${log.user_id}:${log.cohort_id}:${log.type}`),
    );

    const results: {
      userId: string;
      cohortId: string;
      type: ReminderType;
      success: boolean;
    }[] = [];

    for (const candidate of candidates) {
      if (!candidate.email) continue;

      const alreadySentRemind = sentSet.has(
        `${candidate.userId}:${candidate.cohortId}:REMIND`,
      );
      const alreadySentLastCall = sentSet.has(
        `${candidate.userId}:${candidate.cohortId}:LAST_CALL`,
      );

      const reminderType = shouldSendReminder({
        hasSubmittedToday: false,
        prefsEnabled: candidate.prefs.isEnabled,
        remindTimeMinutes: candidate.prefs.remindTimeMinutesBeforeCutoff,
        lastCallMinutes: candidate.prefs.lastCallMinutesBeforeCutoff,
        quietHoursStart: candidate.prefs.quietHoursStart,
        quietHoursEnd: candidate.prefs.quietHoursEnd,
        alreadySentRemind,
        alreadySentLastCall,
      });

      if (!reminderType) continue;

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
        await supabaseAdmin.from("reminder_logs").insert({
          user_id: candidate.userId,
          cohort_id: candidate.cohortId,
          date_key: dateKey,
          type: reminderType,
        });
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
      candidatesFound: candidates.length,
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

export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
  }
  return POST(request);
}
