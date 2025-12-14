import { db } from "./db";
import {
  getIndiaDateKey,
  getLastNDays,
  computeOnTime,
  getIndiaCutoff,
} from "./timezone";

/**
 * Update best streak if current streak is higher
 * Returns true if a new best was set
 */
export async function updateBestStreak(
  userId: string,
  cohortId: string,
  currentStreak: number,
): Promise<{ updated: boolean; bestStreak: number }> {
  const membership = await db.cohortMembers.findUnique({
    user_id: userId,
    cohort_id: cohortId,
  });

  if (!membership) {
    return { updated: false, bestStreak: 0 };
  }

  if (currentStreak > membership.best_streak) {
    await db.cohortMembers.update(userId, cohortId, { best_streak: currentStreak });
    return { updated: true, bestStreak: currentStreak };
  }

  return { updated: false, bestStreak: membership.best_streak };
}

/**
 * Update best rank if current rank is better (lower number = better)
 * Returns true if a new best was set
 */
export async function updateBestRank(
  userId: string,
  cohortId: string,
  currentRank: number,
): Promise<{ updated: boolean; bestRank: number | null }> {
  const membership = await db.cohortMembers.findUnique({
    user_id: userId,
    cohort_id: cohortId,
  });

  if (!membership) {
    return { updated: false, bestRank: null };
  }

  // Lower rank is better. Update if no bestRank yet or if current is better
  if (membership.best_rank === null || currentRank < membership.best_rank) {
    await db.cohortMembers.update(userId, cohortId, { best_rank: currentRank });
    return { updated: true, bestRank: currentRank };
  }

  return { updated: false, bestRank: membership.best_rank };
}

/**
 * Get user's best stats for a cohort
 */
export async function getBestStats(
  userId: string,
  cohortId: string,
): Promise<{ bestStreak: number; bestRank: number | null }> {
  const membership = await db.cohortMembers.findUnique({
    user_id: userId,
    cohort_id: cohortId,
  });

  return {
    bestStreak: membership?.best_streak ?? 0,
    bestRank: membership?.best_rank ?? null,
  };
}

export type CalendarDay = {
  dateKey: string;
  status: "on-time" | "late" | "missed";
};

export type LeaderboardTier = "TOP" | "MIDDLE" | "CATCHING_UP";

export type LeaderboardEntry = {
  userId: string;
  userName: string | null;
  userEmail: string;
  currentStreak: number;
  onTimeCount30Days: number;
  latestSubmissionTime: Date | null;
  rank: number;
  tier: LeaderboardTier;
};

/**
 * Calculate tier based on rank and total members
 * Top 20%, Middle 60%, Catching Up 20%
 */
export function calculateTier(rank: number, total: number): LeaderboardTier {
  if (total <= 2) {
    // With 1-2 members, everyone is in TOP
    return "TOP";
  }

  const percentile = rank / total;

  if (percentile <= 0.2) {
    return "TOP";
  } else if (percentile <= 0.8) {
    return "MIDDLE";
  } else {
    return "CATCHING_UP";
  }
}

/**
 * Compute the current streak for a user in a cohort
 * A streak is consecutive on-time submissions going backwards from today
 */
export async function computeStreak(
  userId: string,
  cohortId: string,
): Promise<number> {
  const today = getIndiaDateKey();
  const now = new Date();

  // Get all submissions for this user in this cohort
  const submissions = await db.submissions.findByUserAndCohort(userId, cohortId);

  // Build a map of dateKey -> submission
  const submissionMap = new Map(submissions.map((s) => [s.date_key, s]));

  let streak = 0;
  const checkDate = new Date(now);

  // If we're past today's deadline and haven't submitted today, streak is 0
  const todayCutoff = getIndiaCutoff(today);
  const todaySubmission = submissionMap.get(today);

  if (now > todayCutoff && !todaySubmission) {
    return 0;
  }

  // If we haven't submitted today but deadline hasn't passed, start checking from yesterday
  if (!todaySubmission && now <= todayCutoff) {
    checkDate.setDate(checkDate.getDate() - 1);
  }

  // Count consecutive on-time days
  while (true) {
    const dateKey = getIndiaDateKey(checkDate);
    const submission = submissionMap.get(dateKey);

    if (!submission) {
      break;
    }

    if (!computeOnTime(new Date(submission.created_at), dateKey)) {
      break;
    }

    streak++;
    checkDate.setDate(checkDate.getDate() - 1);
  }

  return streak;
}

/**
 * Compute calendar data for the last N days
 */
export async function computeCalendar(
  userId: string,
  cohortId: string,
  lastNDays: number = 30,
): Promise<CalendarDay[]> {
  const days = getLastNDays(lastNDays);

  // Get all submissions for this user in this cohort
  const allSubmissions = await db.submissions.findByUserAndCohort(userId, cohortId);

  // Filter to only the days we care about
  const submissions = allSubmissions.filter(s => days.includes(s.date_key));
  const submissionMap = new Map(submissions.map((s) => [s.date_key, s]));

  return days.map((dateKey) => {
    const submission = submissionMap.get(dateKey);

    if (!submission) {
      return { dateKey, status: "missed" as const };
    }

    if (computeOnTime(new Date(submission.created_at), dateKey)) {
      return { dateKey, status: "on-time" as const };
    }

    return { dateKey, status: "late" as const };
  });
}

/**
 * Compute leaderboard for a cohort
 * Ranked by: current streak (desc), on-time submissions in last 30 days (desc), earliest latest submission time (asc)
 */
export async function computeLeaderboard(
  cohortId: string,
): Promise<LeaderboardEntry[]> {
  // Get all members of the cohort
  const members = await db.cohortMembers.findByCohort(cohortId);

  const now = new Date();
  const last30Days = getLastNDays(30);

  // Get all submissions for this cohort
  const allSubmissions = await db.submissions.findMany({ cohort_id: cohortId });

  // Filter to last 30 days
  const submissions = allSubmissions.filter(s => last30Days.includes(s.date_key));

  // Group submissions by userId
  const userSubmissions = new Map<string, typeof submissions>();
  for (const sub of submissions) {
    if (!userSubmissions.has(sub.user_id)) {
      userSubmissions.set(sub.user_id, []);
    }
    userSubmissions.get(sub.user_id)!.push(sub);
  }

  // Calculate stats for each member
  const entries: Omit<LeaderboardEntry, "rank" | "tier">[] = [];

  for (const member of members) {
    const user = member.user;
    const subs = userSubmissions.get(member.user_id) || [];
    const subMap = new Map(subs.map((s) => [s.date_key, s]));

    // Calculate current streak
    let streak = 0;
    const today = getIndiaDateKey(now);
    const todayCutoff = getIndiaCutoff(today);
    const todaySubmission = subMap.get(today);

    const checkDate = new Date(now);

    if (now > todayCutoff && !todaySubmission) {
      streak = 0;
    } else {
      if (!todaySubmission && now <= todayCutoff) {
        checkDate.setDate(checkDate.getDate() - 1);
      }

      while (true) {
        const dateKey = getIndiaDateKey(checkDate);
        const submission = subMap.get(dateKey);

        if (!submission || !computeOnTime(new Date(submission.created_at), dateKey)) {
          break;
        }

        streak++;
        checkDate.setDate(checkDate.getDate() - 1);
      }
    }

    // Count GOOD on-time submissions in last 30 days (for tiebreaker)
    const onTimeCount = subs.filter(
      (s) =>
        computeOnTime(new Date(s.created_at), s.date_key) && s.quality_status === "GOOD",
    ).length;

    // Get latest submission time
    const latestSubmission =
      subs.length > 0
        ? subs.reduce((latest, s) =>
            new Date(s.created_at) > new Date(latest.created_at) ? s : latest,
          )
        : null;

    entries.push({
      userId: member.user_id,
      userName: user?.name || null,
      userEmail: user?.email || "",
      currentStreak: streak,
      onTimeCount30Days: onTimeCount,
      latestSubmissionTime: latestSubmission ? new Date(latestSubmission.created_at) : null,
    });
  }

  // Sort: streak desc, onTimeCount30Days desc, latestSubmissionTime asc (earlier is better)
  entries.sort((a, b) => {
    if (b.currentStreak !== a.currentStreak) {
      return b.currentStreak - a.currentStreak;
    }
    if (b.onTimeCount30Days !== a.onTimeCount30Days) {
      return b.onTimeCount30Days - a.onTimeCount30Days;
    }
    // Earlier submission time is better (wins ties)
    if (a.latestSubmissionTime && b.latestSubmissionTime) {
      return (
        a.latestSubmissionTime.getTime() - b.latestSubmissionTime.getTime()
      );
    }
    if (a.latestSubmissionTime) return -1;
    if (b.latestSubmissionTime) return 1;
    return 0;
  });

  // Add ranks and tiers
  const total = entries.length;
  return entries.map((entry, index) => {
    const rank = index + 1;
    return {
      ...entry,
      rank,
      tier: calculateTier(rank, total),
    };
  });
}
