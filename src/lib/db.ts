import { getSupabaseAdmin } from "./supabase";

/**
 * Database helper functions
 * Provides a clean API layer over Supabase with proper error handling
 */

// Helper to get supabase admin client
function supabase() {
  return getSupabaseAdmin();
}

// Type definitions for database records
export interface User {
  id: string;
  email: string;
  password?: string;
  firebase_uid?: string;
  name?: string;
  onboarding_completed: boolean;
  onboarding_step: number;
  active_cohort_id?: string;
  stripe_customer_id?: string;
  show_exact_rank: boolean;
  created_at: string;
}

export interface Cohort {
  id: string;
  name: string;
  join_code: string;
  status: string;
  trial_ends_at: string;
  activated_at?: string;
  created_at: string;
}

export interface CohortMember {
  id: string;
  user_id: string;
  cohort_id: string;
  role: string;
  joined_at: string;
  best_streak: number;
  best_rank?: number;
  user?: User;
  cohort?: Cohort;
}

export interface Submission {
  id: string;
  user_id: string;
  cohort_id: string;
  date_key: string;
  subject_id?: string;
  subject: string;
  bullet1: string;
  bullet2: string;
  bullet3: string;
  quality_status: string;
  quality_reasons: string;
  feedback_hidden: boolean;
  created_at: string;
}

export interface Subject {
  id: string;
  subject_code: string;
  transcript_name: string;
  full_name: string;
  group_name: string;
  group_number: number;
  sl_available: boolean;
  hl_available: boolean;
  has_units: boolean;
  created_at: string;
}

export interface Unit {
  id: string;
  subject_id: string;
  name: string;
  order_index: number;
  level_scope: string;
  created_at: string;
}

export interface UserSubject {
  id: string;
  user_id: string;
  subject_id: string;
  level: string;
  created_at: string;
  subject?: Subject;
}

export interface Subscription {
  id: string;
  user_id: string;
  stripe_customer_id: string;
  stripe_subscription_id: string;
  status: string;
  current_period_end: string;
  created_at: string;
  updated_at: string;
}

export interface NotificationPrefs {
  id: string;
  user_id: string;
  is_enabled: boolean;
  remind_time_minutes_before_cutoff: number;
  last_call_minutes_before_cutoff: number;
  quiet_hours_start?: number;
  quiet_hours_end?: number;
  created_at: string;
  updated_at: string;
}

// Database helper object
export const db = {
  // Users
  users: {
    async findUnique(where: { id?: string; email?: string }): Promise<User | null> {
      const query = supabase().from("users").select("*");
      if (where.id) query.eq("id", where.id);
      if (where.email) query.eq("email", where.email);
      const { data, error } = await query.maybeSingle();
      if (error && error.code !== "PGRST116") {
        console.error("[db.users.findUnique] Error:", error);
        throw error;
      }
      return data;
    },

    async update(id: string, data: Partial<User>): Promise<User> {
      const { data: updated, error } = await supabase()
        .from("users")
        .update(data)
        .eq("id", id)
        .select()
        .single();
      if (error) {
        console.error("[db.users.update] Error:", error);
        throw error;
      }
      return updated;
    },

    async create(data: Partial<User>): Promise<User> {
      const { data: created, error } = await supabase()
        .from("users")
        .insert(data)
        .select()
        .single();
      if (error) {
        console.error("[db.users.create] Error:", error);
        throw error;
      }
      return created;
    },
  },

  // Cohorts
  cohorts: {
    async findUnique(where: { id?: string; join_code?: string }): Promise<Cohort | null> {
      const query = supabase().from("cohorts").select("*");
      if (where.id) query.eq("id", where.id);
      if (where.join_code) query.eq("join_code", where.join_code);
      const { data, error } = await query.maybeSingle();
      if (error && error.code !== "PGRST116") {
        console.error("[db.cohorts.findUnique] Error:", error);
        throw error;
      }
      return data;
    },

    async create(data: Partial<Cohort>): Promise<Cohort> {
      const { data: created, error } = await supabase()
        .from("cohorts")
        .insert(data)
        .select()
        .single();
      if (error) {
        console.error("[db.cohorts.create] Error:", error);
        throw error;
      }
      return created;
    },

    async update(id: string, data: Partial<Cohort>): Promise<Cohort> {
      const { data: updated, error } = await supabase()
        .from("cohorts")
        .update(data)
        .eq("id", id)
        .select()
        .single();
      if (error) {
        console.error("[db.cohorts.update] Error:", error);
        throw error;
      }
      return updated;
    },
  },

  // Cohort Members
  cohortMembers: {
    async findUnique(where: { user_id: string; cohort_id: string }): Promise<CohortMember | null> {
      const { data, error } = await supabase()
        .from("cohort_members")
        .select("*, cohort:cohorts(*), user:users(*)")
        .eq("user_id", where.user_id)
        .eq("cohort_id", where.cohort_id)
        .maybeSingle();
      if (error && error.code !== "PGRST116") {
        console.error("[db.cohortMembers.findUnique] Error:", error);
        throw error;
      }
      return data;
    },

    async findByUser(userId: string): Promise<CohortMember[]> {
      const { data, error } = await supabase()
        .from("cohort_members")
        .select("*, cohort:cohorts(*), user:users(*)")
        .eq("user_id", userId);
      if (error) {
        console.error("[db.cohortMembers.findByUser] Error:", error);
        throw error;
      }
      return data || [];
    },

    async findByCohort(cohortId: string): Promise<CohortMember[]> {
      const { data, error } = await supabase()
        .from("cohort_members")
        .select("*, user:users(*), cohort:cohorts(*)")
        .eq("cohort_id", cohortId);
      if (error) {
        console.error("[db.cohortMembers.findByCohort] Error:", error);
        throw error;
      }
      return data || [];
    },

    async create(data: Partial<CohortMember>): Promise<CohortMember> {
      const { data: created, error } = await supabase()
        .from("cohort_members")
        .insert(data)
        .select("*, cohort:cohorts(*)")
        .single();
      if (error) {
        console.error("[db.cohortMembers.create] Error:", error);
        throw error;
      }
      return created;
    },

    async update(userId: string, cohortId: string, data: Partial<CohortMember>): Promise<CohortMember> {
      const { data: updated, error } = await supabase()
        .from("cohort_members")
        .update(data)
        .eq("user_id", userId)
        .eq("cohort_id", cohortId)
        .select()
        .single();
      if (error) {
        console.error("[db.cohortMembers.update] Error:", error);
        throw error;
      }
      return updated;
    },
  },

  // Submissions
  submissions: {
    async findUnique(where: { user_id: string; cohort_id: string; date_key: string }): Promise<Submission | null> {
      const { data, error } = await supabase()
        .from("submissions")
        .select("*")
        .eq("user_id", where.user_id)
        .eq("cohort_id", where.cohort_id)
        .eq("date_key", where.date_key)
        .maybeSingle();
      if (error && error.code !== "PGRST116") {
        console.error("[db.submissions.findUnique] Error:", error);
        throw error;
      }
      return data;
    },

    async findMany(where: { user_id?: string; cohort_id?: string; date_key?: string }): Promise<Submission[]> {
      let query = supabase().from("submissions").select("*");
      if (where.user_id) query = query.eq("user_id", where.user_id);
      if (where.cohort_id) query = query.eq("cohort_id", where.cohort_id);
      if (where.date_key) query = query.eq("date_key", where.date_key);
      const { data, error } = await query;
      if (error) {
        console.error("[db.submissions.findMany] Error:", error);
        throw error;
      }
      return data || [];
    },

    async findByUserAndCohort(userId: string, cohortId: string): Promise<Submission[]> {
      const { data, error } = await supabase()
        .from("submissions")
        .select("*")
        .eq("user_id", userId)
        .eq("cohort_id", cohortId)
        .order("date_key", { ascending: false });
      if (error) {
        console.error("[db.submissions.findByUserAndCohort] Error:", error);
        throw error;
      }
      return data || [];
    },

    async create(data: Partial<Submission>): Promise<Submission> {
      const { data: created, error } = await supabase()
        .from("submissions")
        .insert(data)
        .select()
        .single();
      if (error) {
        console.error("[db.submissions.create] Error:", error);
        throw error;
      }
      return created;
    },

    async update(id: string, data: Partial<Submission>): Promise<Submission> {
      const { data: updated, error } = await supabase()
        .from("submissions")
        .update(data)
        .eq("id", id)
        .select()
        .single();
      if (error) {
        console.error("[db.submissions.update] Error:", error);
        throw error;
      }
      return updated;
    },

    async upsert(
      where: { user_id: string; cohort_id: string; date_key: string },
      data: Partial<Submission>
    ): Promise<Submission> {
      const { data: upserted, error } = await supabase()
        .from("submissions")
        .upsert(
          { ...where, ...data },
          { onConflict: "user_id,cohort_id,date_key" }
        )
        .select()
        .single();
      if (error) {
        console.error("[db.submissions.upsert] Error:", error);
        throw error;
      }
      return upserted;
    },
  },

  // Subjects
  subjects: {
    async findAll(): Promise<Subject[]> {
      const { data, error } = await supabase()
        .from("subjects")
        .select("*")
        .order("group_number")
        .order("transcript_name");
      if (error) {
        console.error("[db.subjects.findAll] Error:", error);
        throw error;
      }
      return data || [];
    },

    async findUnique(where: { id?: string; subject_code?: string }): Promise<Subject | null> {
      const query = supabase().from("subjects").select("*");
      if (where.id) query.eq("id", where.id);
      if (where.subject_code) query.eq("subject_code", where.subject_code);
      const { data, error } = await query.maybeSingle();
      if (error && error.code !== "PGRST116") {
        console.error("[db.subjects.findUnique] Error:", error);
        throw error;
      }
      return data;
    },

    async create(data: Partial<Subject>): Promise<Subject> {
      const { data: created, error } = await supabase()
        .from("subjects")
        .insert(data)
        .select()
        .single();
      if (error) {
        console.error("[db.subjects.create] Error:", error);
        throw error;
      }
      return created;
    },

    async upsert(subjectCode: string, data: Partial<Subject>): Promise<Subject> {
      const { data: upserted, error } = await supabase()
        .from("subjects")
        .upsert(
          { subject_code: subjectCode, ...data },
          { onConflict: "subject_code" }
        )
        .select()
        .single();
      if (error) {
        console.error("[db.subjects.upsert] Error:", error);
        throw error;
      }
      return upserted;
    },
  },

  // Units
  units: {
    async findBySubject(subjectId: string): Promise<Unit[]> {
      const { data, error } = await supabase()
        .from("units")
        .select("*")
        .eq("subject_id", subjectId)
        .order("order_index");
      if (error) {
        console.error("[db.units.findBySubject] Error:", error);
        throw error;
      }
      return data || [];
    },

    async findUnique(id: string): Promise<Unit | null> {
      const { data, error } = await supabase()
        .from("units")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error && error.code !== "PGRST116") {
        console.error("[db.units.findUnique] Error:", error);
        throw error;
      }
      return data;
    },

    async create(data: Partial<Unit>): Promise<Unit> {
      const { data: created, error } = await supabase()
        .from("units")
        .insert(data)
        .select()
        .single();
      if (error) {
        console.error("[db.units.create] Error:", error);
        throw error;
      }
      return created;
    },
  },

  // User Subjects
  userSubjects: {
    async findByUser(userId: string): Promise<UserSubject[]> {
      const { data, error } = await supabase()
        .from("user_subjects")
        .select("*, subject:subjects(*)")
        .eq("user_id", userId);
      if (error) {
        console.error("[db.userSubjects.findByUser] Error:", error);
        throw error;
      }
      return data || [];
    },

    async create(data: Partial<UserSubject>): Promise<UserSubject> {
      const { data: created, error } = await supabase()
        .from("user_subjects")
        .insert(data)
        .select("*, subject:subjects(*)")
        .single();
      if (error) {
        console.error("[db.userSubjects.create] Error:", error);
        throw error;
      }
      return created;
    },

    async deleteByUser(userId: string): Promise<void> {
      const { error } = await supabase()
        .from("user_subjects")
        .delete()
        .eq("user_id", userId);
      if (error) {
        console.error("[db.userSubjects.deleteByUser] Error:", error);
        throw error;
      }
    },
  },

  // Weekly Unit Selections
  weeklyUnitSelections: {
    async findByUserAndWeek(userId: string, weekStartDateKey: string) {
      const { data, error } = await supabase()
        .from("weekly_unit_selections")
        .select("*, subject:subjects(*), unit:units(*)")
        .eq("user_id", userId)
        .eq("week_start_date_key", weekStartDateKey);
      if (error) {
        console.error("[db.weeklyUnitSelections.findByUserAndWeek] Error:", error);
        throw error;
      }
      return data || [];
    },

    async upsert(
      where: { user_id: string; subject_id: string; week_start_date_key: string },
      data: { unit_id: string }
    ) {
      const { data: upserted, error } = await supabase()
        .from("weekly_unit_selections")
        .upsert(
          { ...where, ...data },
          { onConflict: "user_id,subject_id,week_start_date_key" }
        )
        .select()
        .single();
      if (error) {
        console.error("[db.weeklyUnitSelections.upsert] Error:", error);
        throw error;
      }
      return upserted;
    },
  },

  // Daily Questions
  dailyQuestions: {
    async findUnique(where: {
      user_id: string;
      cohort_id: string;
      date_key: string;
      subject_id: string;
    }) {
      const { data, error } = await supabase()
        .from("daily_questions")
        .select("*, subject:subjects(*), unit:units(*)")
        .eq("user_id", where.user_id)
        .eq("cohort_id", where.cohort_id)
        .eq("date_key", where.date_key)
        .eq("subject_id", where.subject_id)
        .maybeSingle();
      if (error && error.code !== "PGRST116") {
        console.error("[db.dailyQuestions.findUnique] Error:", error);
        throw error;
      }
      return data;
    },

    async create(data: Record<string, unknown>) {
      const { data: created, error } = await supabase()
        .from("daily_questions")
        .insert(data)
        .select()
        .single();
      if (error) {
        console.error("[db.dailyQuestions.create] Error:", error);
        throw error;
      }
      return created;
    },
  },

  // Subscriptions
  subscriptions: {
    async findByUser(userId: string): Promise<Subscription | null> {
      const { data, error } = await supabase()
        .from("subscriptions")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();
      if (error && error.code !== "PGRST116") {
        console.error("[db.subscriptions.findByUser] Error:", error);
        throw error;
      }
      return data;
    },

    async findByStripeId(stripeSubscriptionId: string): Promise<Subscription | null> {
      const { data, error } = await supabase()
        .from("subscriptions")
        .select("*")
        .eq("stripe_subscription_id", stripeSubscriptionId)
        .maybeSingle();
      if (error && error.code !== "PGRST116") {
        console.error("[db.subscriptions.findByStripeId] Error:", error);
        throw error;
      }
      return data;
    },

    async upsert(userId: string, data: Partial<Subscription>): Promise<Subscription> {
      const { data: upserted, error } = await supabase()
        .from("subscriptions")
        .upsert(
          { user_id: userId, ...data, updated_at: new Date().toISOString() },
          { onConflict: "user_id" }
        )
        .select()
        .single();
      if (error) {
        console.error("[db.subscriptions.upsert] Error:", error);
        throw error;
      }
      return upserted;
    },

    async updateByStripeId(stripeSubscriptionId: string, data: Partial<Subscription>): Promise<Subscription> {
      const { data: updated, error } = await supabase()
        .from("subscriptions")
        .update({ ...data, updated_at: new Date().toISOString() })
        .eq("stripe_subscription_id", stripeSubscriptionId)
        .select()
        .single();
      if (error) {
        console.error("[db.subscriptions.updateByStripeId] Error:", error);
        throw error;
      }
      return updated;
    },
  },

  // Notification Preferences
  notificationPrefs: {
    async findByUser(userId: string): Promise<NotificationPrefs | null> {
      const { data, error } = await supabase()
        .from("notification_prefs")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();
      if (error && error.code !== "PGRST116") {
        console.error("[db.notificationPrefs.findByUser] Error:", error);
        throw error;
      }
      return data;
    },

    async upsert(userId: string, data: Partial<NotificationPrefs>): Promise<NotificationPrefs> {
      const { data: upserted, error } = await supabase()
        .from("notification_prefs")
        .upsert(
          { user_id: userId, ...data, updated_at: new Date().toISOString() },
          { onConflict: "user_id" }
        )
        .select()
        .single();
      if (error) {
        console.error("[db.notificationPrefs.upsert] Error:", error);
        throw error;
      }
      return upserted;
    },
  },

  // Reminder Logs
  reminderLogs: {
    async findUnique(where: {
      user_id: string;
      cohort_id: string;
      date_key: string;
      type: string;
    }) {
      const { data, error } = await supabase()
        .from("reminder_logs")
        .select("*")
        .eq("user_id", where.user_id)
        .eq("cohort_id", where.cohort_id)
        .eq("date_key", where.date_key)
        .eq("type", where.type)
        .maybeSingle();
      if (error && error.code !== "PGRST116") {
        console.error("[db.reminderLogs.findUnique] Error:", error);
        throw error;
      }
      return data;
    },

    async create(data: Record<string, unknown>) {
      const { data: created, error } = await supabase()
        .from("reminder_logs")
        .insert(data)
        .select()
        .single();
      if (error) {
        console.error("[db.reminderLogs.create] Error:", error);
        throw error;
      }
      return created;
    },
  },

  // AI Feedback Reports
  aiFeedbackReports: {
    async create(data: Record<string, unknown>) {
      const { data: created, error } = await supabase()
        .from("ai_feedback_reports")
        .insert(data)
        .select()
        .single();
      if (error) {
        console.error("[db.aiFeedbackReports.create] Error:", error);
        throw error;
      }
      return created;
    },
  },
};
