import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  computeCohortStatus,
  computeTrialEndDate,
  TRIAL_DAYS,
  type CohortStatus,
} from "@/lib/cohort-status";

function generateJoinCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * Compute cohort status info including paid member count
 */
async function getCohortStatusInfo(cohortId: string) {
  const cohort = await prisma.cohort.findUnique({
    where: { id: cohortId },
    include: {
      members: {
        include: {
          user: {
            include: { subscription: true },
          },
        },
      },
    },
  });

  if (!cohort) return null;

  const now = new Date();

  // Count active subscriptions
  const paidCount = cohort.members.filter((m) => {
    const sub = m.user.subscription;
    return sub && sub.status === "active" && sub.currentPeriodEnd > now;
  }).length;

  const statusInfo = computeCohortStatus({
    currentStatus: cohort.status as CohortStatus,
    trialEndsAt: cohort.trialEndsAt,
    activatedAt: cohort.activatedAt,
    paidCount,
    memberCount: cohort.members.length,
  });

  // Update cohort status in DB if it changed
  if (statusInfo.status !== cohort.status) {
    await prisma.cohort.update({
      where: { id: cohortId },
      data: {
        status: statusInfo.status,
        activatedAt:
          statusInfo.status === "ACTIVE" && !cohort.activatedAt
            ? new Date()
            : cohort.activatedAt,
      },
    });
  }

  return {
    ...statusInfo,
    cohortId,
    cohortName: cohort.name,
  };
}

// GET - get user's active cohort and available cohorts
export async function GET(request: NextRequest) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const statusCohortId = searchParams.get("statusFor");

  // If requesting status for a specific cohort
  if (statusCohortId) {
    // Verify membership
    const membership = await prisma.cohortMember.findUnique({
      where: {
        userId_cohortId: { userId: session.user.id, cohortId: statusCohortId },
      },
    });

    if (!membership) {
      return NextResponse.json(
        { error: "Not a member of this cohort" },
        { status: 403 },
      );
    }

    const statusInfo = await getCohortStatusInfo(statusCohortId);
    return NextResponse.json({ statusInfo });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { activeCohortId: true },
  });

  const memberships = await prisma.cohortMember.findMany({
    where: { userId: session.user.id },
    include: {
      cohort: {
        include: {
          _count: { select: { members: true } },
        },
      },
    },
  });

  const cohorts = memberships.map((m) => ({
    id: m.cohort.id,
    name: m.cohort.name,
    joinCode: m.cohort.joinCode,
    memberCount: m.cohort._count.members,
    joinedAt: m.joinedAt,
    isActive: m.cohort.id === user?.activeCohortId,
    role: m.role,
    status: m.cohort.status,
    trialEndsAt: m.cohort.trialEndsAt,
  }));

  // Get active cohort details with status info
  let activeCohort = null;
  let activeCohortStatus = null;

  if (user?.activeCohortId) {
    const active = cohorts.find((c) => c.id === user.activeCohortId);
    if (active) {
      activeCohort = active;
      activeCohortStatus = await getCohortStatusInfo(user.activeCohortId);
    }
  }

  return NextResponse.json({
    cohorts,
    activeCohort,
    activeCohortId: user?.activeCohortId,
    activeCohortStatus,
  });
}

// POST - create, join, or set active cohort
export async function POST(request: NextRequest) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { action, name, joinCode, cohortId } = await request.json();

  // Set active cohort
  if (action === "setActive") {
    if (!cohortId) {
      return NextResponse.json(
        { error: "cohortId is required" },
        { status: 400 },
      );
    }

    // Verify user is a member
    const membership = await prisma.cohortMember.findUnique({
      where: {
        userId_cohortId: { userId: session.user.id, cohortId },
      },
      include: { cohort: true },
    });

    if (!membership) {
      return NextResponse.json(
        { error: "You are not a member of this cohort" },
        { status: 403 },
      );
    }

    await prisma.user.update({
      where: { id: session.user.id },
      data: { activeCohortId: cohortId },
    });

    const statusInfo = await getCohortStatusInfo(cohortId);

    return NextResponse.json({
      success: true,
      activeCohort: {
        id: membership.cohort.id,
        name: membership.cohort.name,
        joinCode: membership.cohort.joinCode,
      },
      statusInfo,
    });
  }

  // Create new cohort
  if (action === "create") {
    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    // Generate unique join code
    let code = generateJoinCode();
    let attempts = 0;
    while (attempts < 10) {
      const existing = await prisma.cohort.findUnique({
        where: { joinCode: code },
      });
      if (!existing) break;
      code = generateJoinCode();
      attempts++;
    }

    // Calculate trial end date
    const trialEndsAt = computeTrialEndDate(new Date());

    // Create cohort and set as active
    const cohort = await prisma.$transaction(async (tx) => {
      const newCohort = await tx.cohort.create({
        data: {
          name,
          joinCode: code,
          status: "TRIAL",
          trialEndsAt,
          members: {
            create: {
              userId: session.user.id,
              role: "OWNER",
            },
          },
        },
      });

      // Set as active cohort
      await tx.user.update({
        where: { id: session.user.id },
        data: { activeCohortId: newCohort.id },
      });

      return newCohort;
    });

    return NextResponse.json({
      id: cohort.id,
      name: cohort.name,
      joinCode: cohort.joinCode,
      isActive: true,
      status: cohort.status,
      trialEndsAt: cohort.trialEndsAt,
    });
  }

  // Join existing cohort
  if (action === "join") {
    if (!joinCode) {
      return NextResponse.json(
        { error: "Join code is required" },
        { status: 400 },
      );
    }

    const cohort = await prisma.cohort.findUnique({
      where: { joinCode: joinCode.toUpperCase() },
    });

    if (!cohort) {
      return NextResponse.json({ error: "Invalid join code" }, { status: 404 });
    }

    // Check if already a member
    const existingMember = await prisma.cohortMember.findUnique({
      where: {
        userId_cohortId: {
          userId: session.user.id,
          cohortId: cohort.id,
        },
      },
    });

    if (existingMember) {
      // Already a member, just set as active
      await prisma.user.update({
        where: { id: session.user.id },
        data: { activeCohortId: cohort.id },
      });

      return NextResponse.json({
        id: cohort.id,
        name: cohort.name,
        joinCode: cohort.joinCode,
        isActive: true,
        alreadyMember: true,
        status: cohort.status,
        trialEndsAt: cohort.trialEndsAt,
      });
    }

    // Join and set as active
    await prisma.$transaction(async (tx) => {
      await tx.cohortMember.create({
        data: {
          userId: session.user.id,
          cohortId: cohort.id,
          role: "MEMBER",
        },
      });

      await tx.user.update({
        where: { id: session.user.id },
        data: { activeCohortId: cohort.id },
      });
    });

    return NextResponse.json({
      id: cohort.id,
      name: cohort.name,
      joinCode: cohort.joinCode,
      isActive: true,
      status: cohort.status,
      trialEndsAt: cohort.trialEndsAt,
    });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
