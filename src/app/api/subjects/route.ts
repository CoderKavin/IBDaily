import { db } from "@/lib/db";
import { supabaseAdmin } from "@/lib/supabase";
import { withAuthGet, success } from "@/lib/api-utils";

// GET - list all subjects grouped by IB group
export const GET = withAuthGet(async () => {
  const subjects = await db.subjects.findAll();

  // Get unit counts for each subject
  const subjectsWithCounts = await Promise.all(
    subjects.map(async (subject) => {
      const units = await db.units.findBySubject(subject.id);
      return {
        ...subject,
        _count: { units: units.length },
      };
    })
  );

  // Group by IB group
  const grouped: Record<string, typeof subjectsWithCounts> = {};
  for (const subject of subjectsWithCounts) {
    if (!grouped[subject.group_name]) {
      grouped[subject.group_name] = [];
    }
    grouped[subject.group_name].push(subject);
  }

  return success({ subjects: subjectsWithCounts, grouped });
});
