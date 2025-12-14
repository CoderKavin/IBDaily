import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getWeekStartDateKey } from "@/lib/timezone";

// GET - get current week's unit selections
export async function GET(request: NextRequest) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const subjectId = searchParams.get("subjectId");

  const currentWeekStart = getWeekStartDateKey();

  if (subjectId) {
    // Get selection for specific subject
    const selection = await prisma.weeklyUnitSelection.findUnique({
      where: {
        userId_subjectId_weekStartDateKey: {
          userId: session.user.id,
          subjectId,
          weekStartDateKey: currentWeekStart,
        },
      },
      include: { unit: true, subject: true },
    });

    return NextResponse.json({ selection, weekStartDateKey: currentWeekStart });
  }

  // Get all selections for current week
  const selections = await prisma.weeklyUnitSelection.findMany({
    where: {
      userId: session.user.id,
      weekStartDateKey: currentWeekStart,
    },
    include: { unit: true, subject: true },
  });

  return NextResponse.json({ selections, weekStartDateKey: currentWeekStart });
}

// POST - set weekly unit for a subject (once per week only)
export async function POST(request: NextRequest) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { subjectId, unitId } = await request.json();

  if (!subjectId || !unitId) {
    return NextResponse.json(
      { error: "subjectId and unitId are required" },
      { status: 400 },
    );
  }

  // Verify user has this subject
  const userSubject = await prisma.userSubject.findUnique({
    where: {
      userId_subjectId: { userId: session.user.id, subjectId },
    },
  });

  if (!userSubject) {
    return NextResponse.json(
      { error: "You don't have this subject" },
      { status: 403 },
    );
  }

  // Verify unit exists and belongs to subject
  const unit = await prisma.unit.findFirst({
    where: {
      id: unitId,
      subjectId,
      OR: [
        { levelScope: "BOTH" },
        { levelScope: userSubject.level === "HL" ? "HL_ONLY" : "SL_ONLY" },
      ],
    },
  });

  if (!unit) {
    return NextResponse.json(
      { error: "Invalid unit for this subject/level" },
      { status: 400 },
    );
  }

  const currentWeekStart = getWeekStartDateKey();

  // Check if already set this week - ENFORCE ONCE PER WEEK
  const existing = await prisma.weeklyUnitSelection.findUnique({
    where: {
      userId_subjectId_weekStartDateKey: {
        userId: session.user.id,
        subjectId,
        weekStartDateKey: currentWeekStart,
      },
    },
    include: { unit: true },
  });

  if (existing) {
    // Already set this week - do not allow change
    return NextResponse.json(
      {
        error: `You already selected "${existing.unit.name}" for this week. You can change it next week.`,
        alreadySet: true,
        currentUnit: existing.unit.name,
      },
      { status: 400 },
    );
  }

  // Create new selection
  await prisma.weeklyUnitSelection.create({
    data: {
      userId: session.user.id,
      subjectId,
      unitId,
      weekStartDateKey: currentWeekStart,
    },
  });

  return NextResponse.json({
    success: true,
    weekStartDateKey: currentWeekStart,
  });
}
