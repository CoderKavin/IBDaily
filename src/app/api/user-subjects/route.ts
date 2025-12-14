import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const MIN_SUBJECTS = 3;
const MAX_SUBJECTS = 6;

// GET - get user's selected subjects
export async function GET() {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userSubjects = await prisma.userSubject.findMany({
    where: { userId: session.user.id },
    include: {
      subject: {
        include: {
          units: {
            orderBy: { orderIndex: "asc" },
          },
        },
      },
    },
    orderBy: { subject: { groupNumber: "asc" } },
  });

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { onboardingCompleted: true },
  });

  return NextResponse.json({
    userSubjects,
    onboardingCompleted: user?.onboardingCompleted ?? false,
    minSubjects: MIN_SUBJECTS,
    maxSubjects: MAX_SUBJECTS,
  });
}

// POST - save user's subject selections (onboarding)
export async function POST(request: NextRequest) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { selections } = await request.json();

  if (!Array.isArray(selections)) {
    return NextResponse.json({ error: "Invalid selections" }, { status: 400 });
  }

  // Enforce 3-6 subjects
  if (selections.length < MIN_SUBJECTS) {
    return NextResponse.json(
      { error: `You must select at least ${MIN_SUBJECTS} subjects` },
      { status: 400 },
    );
  }

  if (selections.length > MAX_SUBJECTS) {
    return NextResponse.json(
      { error: `You can select at most ${MAX_SUBJECTS} subjects` },
      { status: 400 },
    );
  }

  // Validate selections
  for (const sel of selections) {
    if (!sel.subjectId || !sel.level) {
      return NextResponse.json(
        { error: "Each selection needs subjectId and level" },
        { status: 400 },
      );
    }
    if (!["SL", "HL"].includes(sel.level)) {
      return NextResponse.json(
        { error: "Level must be SL or HL" },
        { status: 400 },
      );
    }
  }

  // Check for duplicate subjects
  const subjectIds = selections.map((s: { subjectId: string }) => s.subjectId);
  if (new Set(subjectIds).size !== subjectIds.length) {
    return NextResponse.json(
      { error: "Duplicate subjects not allowed" },
      { status: 400 },
    );
  }

  // Verify all subjects exist and level is allowed
  const subjects = await prisma.subject.findMany({
    where: { id: { in: subjectIds } },
  });

  const subjectMap = new Map(subjects.map((s) => [s.id, s]));

  for (const sel of selections) {
    const subject = subjectMap.get(sel.subjectId);
    if (!subject) {
      return NextResponse.json(
        { error: `Subject ${sel.subjectId} not found` },
        { status: 400 },
      );
    }
    if (sel.level === "HL" && !subject.hlAvailable) {
      return NextResponse.json(
        { error: `${subject.fullName} is not available at HL` },
        { status: 400 },
      );
    }
    if (sel.level === "SL" && !subject.slAvailable) {
      return NextResponse.json(
        { error: `${subject.fullName} is not available at SL` },
        { status: 400 },
      );
    }
  }

  // Delete existing selections and create new ones
  await prisma.$transaction(async (tx) => {
    await tx.userSubject.deleteMany({
      where: { userId: session.user.id },
    });

    await tx.userSubject.createMany({
      data: selections.map((sel: { subjectId: string; level: string }) => ({
        userId: session.user.id,
        subjectId: sel.subjectId,
        level: sel.level,
      })),
    });

    await tx.user.update({
      where: { id: session.user.id },
      data: { onboardingCompleted: true },
    });
  });

  return NextResponse.json({ success: true });
}
