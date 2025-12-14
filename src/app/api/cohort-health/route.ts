import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { supabaseAdmin } from "@/lib/supabase";
import { getIndiaDateKey, getLastNDays } from "@/lib/timezone";

interface DailyStats {
  dateKey: string;
  totalMembers: number;
  submittedCount: number;
  missedCount: number;
  submissionRate: number;
}

interface MemberHealth {
  userId: string;
  userName: string | null;
  userEmail: string;
  currentStreak: number;
  submissionsLast7Days: number;
  submissionsLast30Days: number;
  lastSubmissionDate: string | null;
  status: "active" | "at_risk" | "inactive";
}

interface RetentionMetrics {
  d1: number;
  d3: number;
  d7: number;
}

interface CohortHealthData {
  cohortId: string;
  cohortName: string;
  totalMembers: number;
  activeMembers: number;
  atRiskMembers: number;
  inactiveMembers: number;
  todaySubmissionRate: number;
  weeklyAverageRate: number;
  dailyStats: DailyStats[];
  memberHealth: MemberHealth[];
  retention: RetentionMetrics;
}

// GET - Get cohort health metrics (owner only)
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const cohortId = searchParams.get("cohortId");

  if (!cohortId) {
    return NextResponse.json(
      { error: "cohortId is required" },
      { status: 400 },
    );
  }

  // Verify user is the owner of this cohort
  const membership = await db.cohortMembers.findUnique({
    user_id: session.user.id,
    cohort_id: cohortId,
  });

  if (!membership) {
    return NextResponse.json(
      { error: "Not a member of this cohort" },
      { status: 403 },
    );
  }

  if (membership.role !== "OWNER") {
    return NextResponse.json(
      { error: "Only cohort owners can view health metrics" },
      { status: 403 },
    );
  }

  // Get all members
  const members = await db.cohortMembers.findByCohort(cohortId);

  const today = getIndiaDateKey();
  const last7Days = getLastNDays(7);
  const last30Days = getLastNDays(30);

  // Get all submissions for the last 30 days
  const allSubmissions = await db.submissions.findMany({ cohort_id: cohortId });
  const submissions = allSubmissions.filter(s => last30Days.includes(s.date_key));

  // Build submission maps
  const submissionsByDate = new Map<string, Set<string>>();
  const submissionsByUser = new Map<string, string[]>();

  for (const sub of submissions) {
    if (!submissionsByDate.has(sub.date_key)) {
      submissionsByDate.set(sub.date_key, new Set());
    }
    submissionsByDate.get(sub.date_key)!.add(sub.user_id);

    if (!submissionsByUser.has(sub.user_id)) {
      submissionsByUser.set(sub.user_id, []);
    }
    submissionsByUser.get(sub.user_id)!.push(sub.date_key);
  }

  // Calculate daily stats for last 7 days
  const dailyStats: DailyStats[] = last7Days.map((dateKey) => {
    const submitted = submissionsByDate.get(dateKey)?.size || 0;
    const total = members.length;
    return {
      dateKey,
      totalMembers: total,
      submittedCount: submitted,
      missedCount: total - submitted,
      submissionRate: total > 0 ? Math.round((submitted / total) * 100) : 0,
    };
  });

  // Calculate member health
  const memberHealth: MemberHealth[] = members.map((member) => {
    const userSubs = submissionsByUser.get(member.user_id) || [];
    const last7 = userSubs.filter((d) => last7Days.includes(d)).length;
    const last30 = userSubs.length;

    const sortedDates = [...userSubs].sort().reverse();
    const lastSubmissionDate = sortedDates[0] || null;

    let daysSinceLastSubmission = 999;
    if (lastSubmissionDate) {
      const lastDate = new Date(lastSubmissionDate);
      const todayDate = new Date(today);
      daysSinceLastSubmission = Math.floor(
        (todayDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24),
      );
    }

    let status: "active" | "at_risk" | "inactive";
    if (daysSinceLastSubmission <= 2) {
      status = "active";
    } else if (daysSinceLastSubmission <= 6) {
      status = "at_risk";
    } else {
      status = "inactive";
    }

    let streak = 0;
    const sortedAsc = [...userSubs].sort().reverse();
    for (const dateKey of sortedAsc) {
      if (last7Days.includes(dateKey)) {
        streak++;
      } else {
        break;
      }
    }

    return {
      userId: member.user_id,
      userName: member.user?.name || null,
      userEmail: member.user?.email || "",
      currentStreak: streak,
      submissionsLast7Days: last7,
      submissionsLast30Days: last30,
      lastSubmissionDate,
      status,
    };
  });

  memberHealth.sort((a, b) => {
    const statusOrder = { inactive: 0, at_risk: 1, active: 2 };
    return statusOrder[a.status] - statusOrder[b.status];
  });

  const activeMembers = memberHealth.filter((m) => m.status === "active").length;
  const atRiskMembers = memberHealth.filter((m) => m.status === "at_risk").length;
  const inactiveMembers = memberHealth.filter((m) => m.status === "inactive").length;

  const todayStats = dailyStats.find((d) => d.dateKey === today);
  const todaySubmissionRate = todayStats?.submissionRate || 0;

  const weeklyAverageRate =
    dailyStats.length > 0
      ? Math.round(
          dailyStats.reduce((sum, d) => sum + d.submissionRate, 0) /
            dailyStats.length,
        )
      : 0;

  // Calculate retention metrics
  const retention: RetentionMetrics = { d1: 0, d3: 0, d7: 0 };

  const allUserSubmissions = new Map<string, Set<string>>();
  for (const sub of allSubmissions) {
    if (!allUserSubmissions.has(sub.user_id)) {
      allUserSubmissions.set(sub.user_id, new Set());
    }
    allUserSubmissions.get(sub.user_id)!.add(sub.date_key);
  }

  let d1Retained = 0, d1Eligible = 0;
  let d3Retained = 0, d3Eligible = 0;
  let d7Retained = 0, d7Eligible = 0;

  for (const member of members) {
    const userSubs = allUserSubmissions.get(member.user_id) || new Set();
    const sortedDates = [...userSubs].sort();
    if (sortedDates.length === 0) continue;

    const firstSubmitDate = new Date(sortedDates[0]);

    const day1 = new Date(firstSubmitDate);
    day1.setDate(day1.getDate() + 1);
    const day1Key = getIndiaDateKey(day1);
    if (new Date() >= day1) {
      d1Eligible++;
      if (userSubs.has(day1Key)) d1Retained++;
    }

    const day3 = new Date(firstSubmitDate);
    day3.setDate(day3.getDate() + 3);
    const day3Key = getIndiaDateKey(day3);
    if (new Date() >= day3) {
      d3Eligible++;
      if (userSubs.has(day3Key)) d3Retained++;
    }

    const day7 = new Date(firstSubmitDate);
    day7.setDate(day7.getDate() + 7);
    const day7Key = getIndiaDateKey(day7);
    if (new Date() >= day7) {
      d7Eligible++;
      if (userSubs.has(day7Key)) d7Retained++;
    }
  }

  retention.d1 = d1Eligible > 0 ? Math.round((d1Retained / d1Eligible) * 100) : 0;
  retention.d3 = d3Eligible > 0 ? Math.round((d3Retained / d3Eligible) * 100) : 0;
  retention.d7 = d7Eligible > 0 ? Math.round((d7Retained / d7Eligible) * 100) : 0;

  const healthData: CohortHealthData = {
    cohortId,
    cohortName: membership.cohort.name,
    totalMembers: members.length,
    activeMembers,
    atRiskMembers,
    inactiveMembers,
    todaySubmissionRate,
    weeklyAverageRate,
    dailyStats,
    memberHealth,
    retention,
  };

  return NextResponse.json(healthData);
}
