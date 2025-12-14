import { db } from "@/lib/db";
import { supabaseAdmin } from "@/lib/supabase";
import {
  withAuthGet,
  withAuth,
  success,
  errors,
} from "@/lib/api-utils";
import {
  computeCohortStatus,
  computeTrialEndDate,
  type CohortStatus,
} from "@/lib/cohort-status";

function generateJoinCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * Compute cohort status info including paid member count
 */
async function getCohortStatusInfo(cohortId: string) {
  const { data: cohort } = await supabaseAdmin
    .from("cohorts")
    .select("*")
    .eq("id", cohortId)
    .single();

  if (!cohort) return null;

  const members = await db.cohortMembers.findByCohort(cohortId);

  const now = new Date();

  // Count active subscriptions
  let paidCount = 0;
  for (const member of members) {
    const sub = await db.subscriptions.findByUser(member.user_id);
    if (sub && sub.status === "active" && new Date(sub.current_period_end) > now) {
      paidCount++;
    }
  }

  const statusInfo = computeCohortStatus({
    currentStatus: cohort.status as CohortStatus,
    trialEndsAt: new Date(cohort.trial_ends_at),
    activatedAt: cohort.activated_at ? new Date(cohort.activated_at) : null,
    paidCount,
    memberCount: members.length,
  });

  // Update cohort status in DB if it changed
  if (statusInfo.status !== cohort.status) {
    await supabaseAdmin
      .from("cohorts")
      .update({
        status: statusInfo.status,
        activated_at:
          statusInfo.status === "ACTIVE" && !cohort.activated_at
            ? new Date().toISOString()
            : cohort.activated_at,
      })
      .eq("id", cohortId);
  }

  return {
    ...statusInfo,
    cohortId,
    cohortName: cohort.name,
  };
}

// GET - get user's active cohort and available cohorts
export const GET = withAuthGet(async ({ session, searchParams }) => {
  const statusCohortId = searchParams.get("statusFor");

  // If requesting status for a specific cohort
  if (statusCohortId) {
    // Verify membership
    const membership = await db.cohortMembers.findUnique({
      user_id: session.user.id,
      cohort_id: statusCohortId,
    });

    if (!membership) {
      return errors.notMember();
    }

    const statusInfo = await getCohortStatusInfo(statusCohortId);
    return success({ statusInfo });
  }

  const user = await db.users.findUnique({ id: session.user.id });
  const memberships = await db.cohortMembers.findByUser(session.user.id);

  // Get member counts for each cohort
  const cohorts = await Promise.all(
    memberships.map(async (m) => {
      const allMembers = await db.cohortMembers.findByCohort(m.cohort_id);
      return {
        id: m.cohort.id,
        name: m.cohort.name,
        joinCode: m.cohort.join_code,
        memberCount: allMembers.length,
        joinedAt: m.joined_at,
        isActive: m.cohort.id === user?.active_cohort_id,
        role: m.role,
        status: m.cohort.status,
        trialEndsAt: m.cohort.trial_ends_at,
      };
    })
  );

  // Get active cohort details with status info
  let activeCohort = null;
  let activeCohortStatus = null;

  if (user?.active_cohort_id) {
    const active = cohorts.find((c) => c.id === user.active_cohort_id);
    if (active) {
      activeCohort = active;
      activeCohortStatus = await getCohortStatusInfo(user.active_cohort_id);
    }
  }

  return success({
    cohorts,
    activeCohort,
    activeCohortId: user?.active_cohort_id,
    activeCohortStatus,
  });
});

// POST - create, join, or set active cohort
export const POST = withAuth<{
  action: string;
  name?: string;
  joinCode?: string;
  cohortId?: string;
}>(async ({ session, body }) => {
  const { action, name, joinCode, cohortId } = body;

  // Set active cohort
  if (action === "setActive") {
    if (!cohortId) {
      return errors.missingParam("cohortId");
    }

    // Verify user is a member
    const membership = await db.cohortMembers.findUnique({
      user_id: session.user.id,
      cohort_id: cohortId,
    });

    if (!membership) {
      return errors.notMember();
    }

    await db.users.update(session.user.id, { active_cohort_id: cohortId });

    const statusInfo = await getCohortStatusInfo(cohortId);

    return success({
      activeCohort: {
        id: membership.cohort.id,
        name: membership.cohort.name,
        joinCode: membership.cohort.join_code,
      },
      statusInfo,
    });
  }

  // Create new cohort
  if (action === "create") {
    if (!name) {
      return errors.missingParam("name");
    }

    // Generate unique join code
    let code = generateJoinCode();
    let attempts = 0;
    while (attempts < 10) {
      const existing = await db.cohorts.findUnique({ join_code: code });
      if (!existing) break;
      code = generateJoinCode();
      attempts++;
    }

    // Calculate trial end date
    const trialEndsAt = computeTrialEndDate(new Date());

    // Create cohort
    const cohort = await db.cohorts.create({
      name,
      join_code: code,
      status: "TRIAL",
      trial_ends_at: trialEndsAt.toISOString(),
    });

    // Add user as owner
    await db.cohortMembers.create({
      user_id: session.user.id,
      cohort_id: cohort.id,
      role: "OWNER",
    });

    // Set as active cohort
    await db.users.update(session.user.id, { active_cohort_id: cohort.id });

    return success({
      id: cohort.id,
      name: cohort.name,
      joinCode: cohort.join_code,
      isActive: true,
      status: cohort.status,
      trialEndsAt: cohort.trial_ends_at,
    });
  }

  // Join existing cohort
  if (action === "join") {
    if (!joinCode) {
      return errors.missingParam("joinCode");
    }

    const cohort = await db.cohorts.findUnique({ join_code: joinCode.toUpperCase() });

    if (!cohort) {
      return errors.validation(
        "Invalid join code. Please check and try again.",
      );
    }

    // Check if already a member
    const existingMember = await db.cohortMembers.findUnique({
      user_id: session.user.id,
      cohort_id: cohort.id,
    });

    if (existingMember) {
      // Already a member, just set as active
      await db.users.update(session.user.id, { active_cohort_id: cohort.id });

      return success({
        id: cohort.id,
        name: cohort.name,
        joinCode: cohort.join_code,
        isActive: true,
        alreadyMember: true,
        status: cohort.status,
        trialEndsAt: cohort.trial_ends_at,
      });
    }

    // Join cohort
    await db.cohortMembers.create({
      user_id: session.user.id,
      cohort_id: cohort.id,
      role: "MEMBER",
    });

    // Set as active
    await db.users.update(session.user.id, { active_cohort_id: cohort.id });

    return success({
      id: cohort.id,
      name: cohort.name,
      joinCode: cohort.join_code,
      isActive: true,
      status: cohort.status,
      trialEndsAt: cohort.trial_ends_at,
    });
  }

  return errors.validation("Invalid action");
});
