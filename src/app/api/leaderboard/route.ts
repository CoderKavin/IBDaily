import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { computeLeaderboard } from "@/lib/streak";

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

  const leaderboard = await computeLeaderboard(cohortId);

  return NextResponse.json({
    leaderboard,
    cohort: {
      id: membership.cohort.id,
      name: membership.cohort.name,
    },
    currentUserId: session.user.id,
  });
}
