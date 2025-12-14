import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET - list all subjects grouped by IB group
export async function GET() {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const subjects = await prisma.subject.findMany({
    orderBy: [{ groupNumber: "asc" }, { fullName: "asc" }],
    include: {
      _count: { select: { units: true } },
    },
  });

  // Group by IB group
  const grouped: Record<string, typeof subjects> = {};
  for (const subject of subjects) {
    if (!grouped[subject.groupName]) {
      grouped[subject.groupName] = [];
    }
    grouped[subject.groupName].push(subject);
  }

  return NextResponse.json({ subjects, grouped });
}
