import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET - get units for a subject
export async function GET(request: NextRequest) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const subjectId = searchParams.get("subjectId");

  if (!subjectId) {
    return NextResponse.json({ error: "subjectId is required" }, { status: 400 });
  }

  // Verify user has this subject
  const userSubject = await prisma.userSubject.findUnique({
    where: {
      userId_subjectId: { userId: session.user.id, subjectId },
    },
  });

  if (!userSubject) {
    return NextResponse.json({ error: "You don't have this subject" }, { status: 403 });
  }

  const units = await prisma.unit.findMany({
    where: {
      subjectId,
      OR: [
        { levelScope: "BOTH" },
        { levelScope: userSubject.level === "HL" ? "HL_ONLY" : "SL_ONLY" },
      ],
    },
    orderBy: { orderIndex: "asc" },
  });

  return NextResponse.json({ units, level: userSubject.level });
}
