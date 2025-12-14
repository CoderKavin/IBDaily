import { db } from "@/lib/db";
import { withAuthGet, success, errors, requireParam } from "@/lib/api-utils";
import {
  computeStreak,
  computeCalendar,
  updateBestStreak,
  getBestStats,
} from "@/lib/streak";
import { getIndiaDateKey, getTimeUntilDeadline } from "@/lib/timezone";

export const GET = withAuthGet(async ({ session, searchParams }) => {
  const cohortId = requireParam(searchParams, "cohortId");

  // Verify membership
  const membership = await db.cohortMembers.findUnique({
    user_id: session.user.id,
    cohort_id: cohortId,
  });

  if (!membership) {
    return errors.notMember();
  }

  const [streak, calendar] = await Promise.all([
    computeStreak(session.user.id, cohortId),
    computeCalendar(session.user.id, cohortId, 30),
  ]);

  // Update best streak if current is higher
  await updateBestStreak(session.user.id, cohortId, streak);

  // Get best stats (including bestRank which is updated by leaderboard)
  const bestStats = await getBestStats(session.user.id, cohortId);

  // Get today's submission status
  const todayKey = getIndiaDateKey();
  const todaySubmission = await db.submissions.findUnique({
    user_id: session.user.id,
    cohort_id: cohortId,
    date_key: todayKey,
  });

  return success({
    streak,
    calendar,
    todayKey,
    todaySubmission,
    timeUntilDeadline: getTimeUntilDeadline(),
    cohort: {
      id: membership.cohort.id,
      name: membership.cohort.name,
    },
    bestStreak: bestStats.bestStreak,
    bestRank: bestStats.bestRank,
  });
});
