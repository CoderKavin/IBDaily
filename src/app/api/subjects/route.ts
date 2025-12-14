import { prisma } from "@/lib/prisma";
import { withAuthGet, success } from "@/lib/api-utils";

// GET - list all subjects grouped by IB group
export const GET = withAuthGet(async () => {
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

  return success({ subjects, grouped });
});
