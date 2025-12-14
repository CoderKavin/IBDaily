import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const VALID_REASONS = ["WRONG", "CONFUSING", "TOO_HARSH", "OTHER"] as const;

const reportSchema = z.object({
  submissionId: z.string().min(1),
  reason: z.enum(VALID_REASONS),
  notes: z.string().max(500).optional(),
});

// POST - Report AI feedback issue
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = reportSchema.parse(body);

    // Verify the submission belongs to the user
    const submission = await prisma.submission.findUnique({
      where: { id: parsed.submissionId },
      select: { id: true, userId: true },
    });

    if (!submission) {
      return NextResponse.json(
        { error: "Submission not found" },
        { status: 404 },
      );
    }

    if (submission.userId !== session.user.id) {
      return NextResponse.json(
        { error: "You can only report feedback on your own submissions" },
        { status: 403 },
      );
    }

    // Check if user already reported this submission
    const existingReport = await prisma.aIFeedbackReport.findFirst({
      where: {
        userId: session.user.id,
        submissionId: parsed.submissionId,
      },
    });

    if (existingReport) {
      // Update existing report
      const updated = await prisma.aIFeedbackReport.update({
        where: { id: existingReport.id },
        data: {
          reason: parsed.reason,
          notes: parsed.notes || null,
        },
      });

      return NextResponse.json({
        report: updated,
        message: "Report updated",
      });
    }

    // Create new report and hide the feedback
    const [report] = await prisma.$transaction([
      prisma.aIFeedbackReport.create({
        data: {
          userId: session.user.id,
          submissionId: parsed.submissionId,
          reason: parsed.reason,
          notes: parsed.notes || null,
        },
      }),
      prisma.submission.update({
        where: { id: parsed.submissionId },
        data: { feedbackHidden: true },
      }),
    ]);

    return NextResponse.json({
      report,
      feedbackHidden: true,
      message: "Report submitted and feedback hidden",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request data", details: error.issues },
        { status: 400 },
      );
    }
    console.error("Error submitting feedback report:", error);
    return NextResponse.json(
      { error: "Failed to submit report" },
      { status: 500 },
    );
  }
}

// GET - Get user's reports (optional, for showing existing reports)
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const submissionId = searchParams.get("submissionId");

  if (submissionId) {
    // Get report for specific submission
    const report = await prisma.aIFeedbackReport.findFirst({
      where: {
        userId: session.user.id,
        submissionId,
      },
    });

    return NextResponse.json({ report });
  }

  // Get all user's reports
  const reports = await prisma.aIFeedbackReport.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return NextResponse.json({ reports });
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

  // Verify ownership
  const report = await prisma.aIFeedbackReport.findUnique({
    where: { id: reportId },
  });

  if (!report) {
    return NextResponse.json({ error: "Report not found" }, { status: 404 });
  }

  if (report.userId !== session.user.id) {
    return NextResponse.json(
      { error: "You can only delete your own reports" },
      { status: 403 },
    );
  }

  await prisma.aIFeedbackReport.delete({
    where: { id: reportId },
  });

  return NextResponse.json({ message: "Report deleted" });
}
