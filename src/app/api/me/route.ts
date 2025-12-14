import { prisma } from "@/lib/prisma";
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
  const membership = await prisma.cohortMember.findUnique({
    where: {
      userId_cohortId: {
        userId: session.user.id,
        cohortId,
      },
    },
    include: {
      cohort: true,
    },
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
  const todaySubmission = await prisma.submission.findUnique({
    where: {
      userId_cohortId_dateKey: {
        userId: session.user.id,
        cohortId,
        dateKey: todayKey,
      },
    },
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
