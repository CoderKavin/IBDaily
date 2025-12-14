import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { supabaseAdmin } from "@/lib/supabase";

const VALID_REASONS = ["WRONG", "CONFUSING", "TOO_HARSH", "OTHER"] as const;

// POST - Report AI feedback issue
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { submissionId, reason, notes } = body;

    if (!submissionId || !reason) {
      return NextResponse.json(
        { error: "submissionId and reason are required" },
        { status: 400 },
      );
    }

    if (!VALID_REASONS.includes(reason)) {
      return NextResponse.json(
        { error: "Invalid reason" },
        { status: 400 },
      );
    }

    // Verify the submission belongs to the user
    const { data: submission } = await supabaseAdmin
      .from("submissions")
      .select("id, user_id")
      .eq("id", submissionId)
      .single();

    if (!submission) {
      return NextResponse.json(
        { error: "Submission not found" },
        { status: 404 },
      );
    }

    if (submission.user_id !== session.user.id) {
      return NextResponse.json(
        { error: "You can only report feedback on your own submissions" },
        { status: 403 },
      );
    }

    // Check if user already reported this submission
    const { data: existingReport } = await supabaseAdmin
      .from("ai_feedback_reports")
      .select("*")
      .eq("user_id", session.user.id)
      .eq("submission_id", submissionId)
      .single();

    if (existingReport) {
      // Update existing report
      const { data: updated } = await supabaseAdmin
        .from("ai_feedback_reports")
        .update({
          reason,
          notes: notes || null,
        })
        .eq("id", existingReport.id)
        .select()
        .single();

      return NextResponse.json({
        report: updated,
        message: "Report updated",
      });
    }

    // Create new report
    const { data: report } = await supabaseAdmin
      .from("ai_feedback_reports")
      .insert({
        user_id: session.user.id,
        submission_id: submissionId,
        reason,
        notes: notes || null,
      })
      .select()
      .single();

    // Hide the feedback
    await supabaseAdmin
      .from("submissions")
      .update({ feedback_hidden: true })
      .eq("id", submissionId);

    return NextResponse.json({
      report,
      feedbackHidden: true,
      message: "Report submitted and feedback hidden",
    });
  } catch (error) {
    console.error("Error submitting feedback report:", error);
    return NextResponse.json(
      { error: "Failed to submit report" },
      { status: 500 },
    );
  }
}

// GET - Get user's reports
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const submissionId = searchParams.get("submissionId");

  if (submissionId) {
    const { data: report } = await supabaseAdmin
      .from("ai_feedback_reports")
      .select("*")
      .eq("user_id", session.user.id)
      .eq("submission_id", submissionId)
      .single();

    return NextResponse.json({ report });
  }

  const { data: reports } = await supabaseAdmin
    .from("ai_feedback_reports")
    .select("*")
    .eq("user_id", session.user.id)
    .order("created_at", { ascending: false })
    .limit(50);

  return NextResponse.json({ reports: reports || [] });
}

// DELETE - Remove a report
export async function DELETE(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const reportId = searchParams.get("reportId");

  if (!reportId) {
    return NextResponse.json(
      { error: "reportId is required" },
      { status: 400 },
    );
  }

  const { data: report } = await supabaseAdmin
    .from("ai_feedback_reports")
    .select("*")
    .eq("id", reportId)
    .single();

  if (!report) {
    return NextResponse.json({ error: "Report not found" }, { status: 404 });
  }

  if (report.user_id !== session.user.id) {
    return NextResponse.json(
      { error: "You can only delete your own reports" },
      { status: 403 },
    );
  }

  await supabaseAdmin
    .from("ai_feedback_reports")
    .delete()
    .eq("id", reportId);

  return NextResponse.json({ message: "Report deleted" });
}
