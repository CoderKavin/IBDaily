import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getIndiaDateKey } from "@/lib/timezone";

// GET - get today's submission for a cohort
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

  // Verify membership
  const membership = await prisma.cohortMember.findUnique({
    where: {
      userId_cohortId: {
        userId: session.user.id,
        cohortId,
      },
    },
  });

  if (!membership) {
    return NextResponse.json(
      { error: "Not a member of this cohort" },
      { status: 403 },
    );
  }

  const todayKey = getIndiaDateKey();

  const submission = await prisma.submission.findUnique({
    where: {
      userId_cohortId_dateKey: {
        userId: session.user.id,
        cohortId,
        dateKey: todayKey,
      },
    },
  });

  // Get user's subjects for dropdown
  const userSubjects = await prisma.userSubject.findMany({
    where: { userId: session.user.id },
    include: { subject: true },
    orderBy: { subject: { groupNumber: "asc" } },
  });

  // Format subjects for dropdown: "Subject Name (SL/HL)"
  const subjects = userSubjects.map((us) => ({
    id: us.subject.id,
    label: `${us.subject.transcriptName} ${us.level}`,
    fullName: us.subject.fullName,
    level: us.level,
    hasUnits: us.subject.hasUnits,
  }));

  // Check if user needs onboarding
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { onboardingCompleted: true },
  });

  return NextResponse.json({
    submission,
    subjects,
    todayKey,
    needsOnboarding: !user?.onboardingCompleted || subjects.length === 0,
  });
}

// POST - create or update today's submission
export async function POST(request: NextRequest) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { cohortId, subjectId, bullet1, bullet2, bullet3 } =
    await request.json();

  if (!cohortId || !subjectId || !bullet1 || !bullet2 || !bullet3) {
    return NextResponse.json(
      { error: "All fields are required" },
      { status: 400 },
    );
  }

  // Validate bullet lengths
  if (bullet1.length > 140 || bullet2.length > 140 || bullet3.length > 140) {
    return NextResponse.json(
      { error: "Each bullet must be 140 characters or less" },
      { status: 400 },
    );
  }

  // Verify membership
  const membership = await prisma.cohortMember.findUnique({
    where: {
      userId_cohortId: {
        userId: session.user.id,
        cohortId,
      },
    },
  });

  if (!membership) {
    return NextResponse.json(
      { error: "Not a member of this cohort" },
      { status: 403 },
    );
  }

  // Verify user has this subject and get display name
  const userSubject = await prisma.userSubject.findUnique({
    where: {
      userId_subjectId: { userId: session.user.id, subjectId },
    },
    include: { subject: true },
  });

  if (!userSubject) {
    return NextResponse.json(
      { error: "You don't have this subject" },
      { status: 403 },
    );
  }

  const subjectDisplayName = `${userSubject.subject.transcriptName} ${userSubject.level}`;
  const todayKey = getIndiaDateKey();

  // Upsert submission
  const submission = await prisma.submission.upsert({
    where: {
      userId_cohortId_dateKey: {
        userId: session.user.id,
        cohortId,
        dateKey: todayKey,
      },
    },
    update: {
      subjectId,
      subject: subjectDisplayName,
      bullet1,
      bullet2,
      bullet3,
      createdAt: new Date(),
    },
    create: {
      userId: session.user.id,
      cohortId,
      dateKey: todayKey,
      subjectId,
      subject: subjectDisplayName,
      bullet1,
      bullet2,
      bullet3,
    },
  });

  return NextResponse.json({ submission });
}
