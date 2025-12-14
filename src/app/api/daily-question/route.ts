import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getIndiaDateKey, getWeekStartDateKey } from "@/lib/timezone";
import { getAiClient, isAiEnabled, type DifficultyRung } from "@/lib/ai-client";

// GET - get today's question for a subject in a cohort
export async function GET(request: NextRequest) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const cohortId = searchParams.get("cohortId");
  const subjectId = searchParams.get("subjectId");

  if (!cohortId) {
    return NextResponse.json({ error: "cohortId is required" }, { status: 400 });
  }

  const todayKey = getIndiaDateKey();

  // If subjectId provided, get specific question
  if (subjectId) {
    const question = await prisma.dailyQuestion.findUnique({
      where: {
        userId_cohortId_dateKey_subjectId: {
          userId: session.user.id,
          cohortId,
          dateKey: todayKey,
          subjectId,
        },
      },
      include: { subject: true, unit: true },
    });

    return NextResponse.json({ question, todayKey, aiEnabled: isAiEnabled() });
  }

  // Get all questions for today
  const questions = await prisma.dailyQuestion.findMany({
    where: {
      userId: session.user.id,
      cohortId,
      dateKey: todayKey,
    },
    include: { subject: true, unit: true },
  });

  return NextResponse.json({ questions, todayKey, aiEnabled: isAiEnabled() });
}

// POST - generate a new question for today
export async function POST(request: NextRequest) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isAiEnabled()) {
    return NextResponse.json({ error: "AI features are not configured" }, { status: 503 });
  }

  const { cohortId, subjectId, difficultyRung = 1 } = await request.json();

  if (!cohortId || !subjectId) {
    return NextResponse.json({ error: "cohortId and subjectId are required" }, { status: 400 });
  }

  if (![1, 2, 3].includes(difficultyRung)) {
    return NextResponse.json({ error: "difficultyRung must be 1, 2, or 3" }, { status: 400 });
  }

  // Verify membership
  const membership = await prisma.cohortMember.findUnique({
    where: {
      userId_cohortId: { userId: session.user.id, cohortId },
    },
  });

  if (!membership) {
    return NextResponse.json({ error: "Not a member of this cohort" }, { status: 403 });
  }

  // Verify user has this subject and get level
  const userSubject = await prisma.userSubject.findUnique({
    where: {
      userId_subjectId: { userId: session.user.id, subjectId },
    },
    include: { subject: true },
  });

  if (!userSubject) {
    return NextResponse.json({ error: "You don't have this subject" }, { status: 403 });
  }

  const todayKey = getIndiaDateKey();
  const currentWeekStart = getWeekStartDateKey();

  // Get current week's unit selection
  const weeklySelection = await prisma.weeklyUnitSelection.findUnique({
    where: {
      userId_subjectId_weekStartDateKey: {
        userId: session.user.id,
        subjectId,
        weekStartDateKey: currentWeekStart,
      },
    },
    include: { unit: true },
  });

  // Check if subject has units - if so, require unit selection
  if (userSubject.subject.hasUnits && !weeklySelection) {
    return NextResponse.json({
      error: "Please select a weekly unit for this subject first",
      needsUnitSelection: true,
    }, { status: 400 });
  }

  // Check if question already exists for today
  const existing = await prisma.dailyQuestion.findUnique({
    where: {
      userId_cohortId_dateKey_subjectId: {
        userId: session.user.id,
        cohortId,
        dateKey: todayKey,
        subjectId,
      },
    },
    include: { subject: true, unit: true },
  });

  if (existing) {
    return NextResponse.json({ question: existing, alreadyExists: true });
  }

  // Generate question using AI
  const aiClient = getAiClient();

  try {
    const generated = await aiClient.generateQuestion({
      subjectName: userSubject.subject.fullName,
      level: userSubject.level as "SL" | "HL",
      unitName: weeklySelection?.unit.name || "General",
      difficultyRung: difficultyRung as DifficultyRung,
    });

    // Save the question
    const question = await prisma.dailyQuestion.create({
      data: {
        userId: session.user.id,
        cohortId,
        dateKey: todayKey,
        subjectId,
        level: userSubject.level,
        unitId: weeklySelection?.unitId || null,
        difficultyRung,
        questionText: generated.questionText,
        markingGuideText: generated.markingGuideText,
        commonMistakesText: generated.commonMistakesText,
      },
      include: { subject: true, unit: true },
    });

    return NextResponse.json({ question });
  } catch (error) {
    console.error("Question generation failed:", error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Failed to generate question",
    }, { status: 500 });
  }
}
