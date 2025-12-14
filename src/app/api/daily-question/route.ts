import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { supabaseAdmin } from "@/lib/supabase";
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
    return NextResponse.json(
      { error: "cohortId is required" },
      { status: 400 },
    );
  }

  const todayKey = getIndiaDateKey();

  // If subjectId provided, get specific question
  if (subjectId) {
    const question = await db.dailyQuestions.findUnique({
      user_id: session.user.id,
      cohort_id: cohortId,
      date_key: todayKey,
      subject_id: subjectId,
    });

    return NextResponse.json({ question, todayKey, aiEnabled: isAiEnabled() });
  }

  // Get all questions for today
  const { data: questions } = await supabaseAdmin
    .from("daily_questions")
    .select("*, subject:subjects(*), unit:units(*)")
    .eq("user_id", session.user.id)
    .eq("cohort_id", cohortId)
    .eq("date_key", todayKey);

  return NextResponse.json({ questions: questions || [], todayKey, aiEnabled: isAiEnabled() });
}

// POST - generate a new question for today
export async function POST(request: NextRequest) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isAiEnabled()) {
    return NextResponse.json(
      { error: "AI features are not configured" },
      { status: 503 },
    );
  }

  const { cohortId, subjectId, difficultyRung = 1 } = await request.json();

  if (!cohortId || !subjectId) {
    return NextResponse.json(
      { error: "cohortId and subjectId are required" },
      { status: 400 },
    );
  }

  if (![1, 2, 3].includes(difficultyRung)) {
    return NextResponse.json(
      { error: "difficultyRung must be 1, 2, or 3" },
      { status: 400 },
    );
  }

  // Verify membership
  const membership = await db.cohortMembers.findUnique({
    user_id: session.user.id,
    cohort_id: cohortId,
  });

  if (!membership) {
    return NextResponse.json(
      { error: "Not a member of this cohort" },
      { status: 403 },
    );
  }

  // Verify user has this subject and get level
  const userSubjects = await db.userSubjects.findByUser(session.user.id);
  const userSubject = userSubjects.find((us) => us.subject_id === subjectId);

  if (!userSubject) {
    return NextResponse.json(
      { error: "You don't have this subject" },
      { status: 403 },
    );
  }

  const todayKey = getIndiaDateKey();
  const currentWeekStart = getWeekStartDateKey();

  // Get current week's unit selection
  const { data: weeklySelection } = await supabaseAdmin
    .from("weekly_unit_selections")
    .select("*, unit:units(*)")
    .eq("user_id", session.user.id)
    .eq("subject_id", subjectId)
    .eq("week_start_date_key", currentWeekStart)
    .single();

  // Carry-forward: if no selection this week, check last week
  let unitSelection = weeklySelection;
  if (!unitSelection && userSubject.subject.has_units) {
    const [year, month, day] = currentWeekStart.split("-").map(Number);
    const prevWeekDate = new Date(year, month - 1, day - 7);
    const prevWeekFormatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    const previousWeekStart = prevWeekFormatter.format(prevWeekDate);

    const { data: lastWeekSelection } = await supabaseAdmin
      .from("weekly_unit_selections")
      .select("*, unit:units(*)")
      .eq("user_id", session.user.id)
      .eq("subject_id", subjectId)
      .eq("week_start_date_key", previousWeekStart)
      .single();

    unitSelection = lastWeekSelection;
  }

  // Check if subject has units - if so, require unit selection
  if (userSubject.subject.has_units && !unitSelection) {
    return NextResponse.json(
      {
        error: "Please select a weekly unit for this subject first",
        needsUnitSelection: true,
      },
      { status: 400 },
    );
  }

  // Check if question already exists for today
  const existing = await db.dailyQuestions.findUnique({
    user_id: session.user.id,
    cohort_id: cohortId,
    date_key: todayKey,
    subject_id: subjectId,
  });

  if (existing) {
    return NextResponse.json({ question: existing, alreadyExists: true });
  }

  // Generate question using AI
  const aiClient = getAiClient();

  try {
    const generated = await aiClient.generateQuestion({
      subjectName: userSubject.subject.full_name,
      level: userSubject.level as "SL" | "HL",
      unitName: unitSelection?.unit.name || "General",
      difficultyRung: difficultyRung as DifficultyRung,
    });

    // Save the question
    const question = await db.dailyQuestions.create({
      user_id: session.user.id,
      cohort_id: cohortId,
      date_key: todayKey,
      subject_id: subjectId,
      level: userSubject.level,
      unit_id: unitSelection?.unit_id || null,
      difficulty_rung: difficultyRung,
      question_text: generated.questionText,
      marking_guide_text: generated.markingGuideText,
      common_mistakes_text: generated.commonMistakesText,
    });

    return NextResponse.json({ question });
  } catch (error) {
    console.error("Question generation failed:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to generate question",
      },
      { status: 500 },
    );
  }
}
