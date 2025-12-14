import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { computeStreak, computeCalendar } from "@/lib/streak";
import { getIndiaDateKey, getTimeUntilDeadline } from "@/lib/timezone";

export async function GET(request: NextRequest) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const cohortId = searchParams.get("cohortId");

  if (!cohortId) {
    return NextResponse.json({ error: "cohortId is required" }, { status: 400 });
  }

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
    return NextResponse.json({ error: "Not a member of this cohort" }, { status: 403 });
  }

  const [streak, calendar] = await Promise.all([
    computeStreak(session.user.id, cohortId),
    computeCalendar(session.user.id, cohortId, 30),
  ]);

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

  return NextResponse.json({
    streak,
    calendar,
    todayKey,
    todaySubmission,
    timeUntilDeadline: getTimeUntilDeadline(),
    cohort: {
      id: membership.cohort.id,
      name: membership.cohort.name,
    },
  });
}
