import { db } from "@/lib/db";
import { withAuthGet, success, errors, requireParam } from "@/lib/api-utils";
import { computeLeaderboard, updateBestRank } from "@/lib/streak";

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

  const leaderboard = await computeLeaderboard(cohortId);

  // Find current user's rank and update best rank if improved
  const currentUserEntry = leaderboard.find(
    (e) => e.userId === session.user.id,
  );
  if (currentUserEntry) {
    await updateBestRank(session.user.id, cohortId, currentUserEntry.rank);
  }

  return success({
    leaderboard,
    cohort: {
      id: membership.cohort.id,
      name: membership.cohort.name,
    },
    currentUserId: session.user.id,
  });
});
