import { supabaseAdmin } from "./supabase";

// Database helper functions that mirror Prisma's API style
// This makes migration easier and keeps code clean

export const db = {
  // Users
  users: {
    async findUnique(where: { id?: string; email?: string }) {
      const query = supabaseAdmin.from("users").select("*");
      if (where.id) query.eq("id", where.id);
      if (where.email) query.eq("email", where.email);
      const { data, error } = await query.single();
      if (error && error.code !== "PGRST116") throw error;
      return data;
    },
    async update(id: string, data: Record<string, unknown>) {
      const { data: updated, error } = await supabaseAdmin
        .from("users")
        .update(data)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return updated;
    },
    async create(data: Record<string, unknown>) {
      const { data: created, error } = await supabaseAdmin
        .from("users")
        .insert(data)
        .select()
        .single();
      if (error) throw error;
      return created;
    },
  },

  // Cohorts
  cohorts: {
    async findUnique(where: { id?: string; join_code?: string }) {
      const query = supabaseAdmin.from("cohorts").select("*");
      if (where.id) query.eq("id", where.id);
      if (where.join_code) query.eq("join_code", where.join_code);
      const { data, error } = await query.single();
      if (error && error.code !== "PGRST116") throw error;
      return data;
    },
    async create(data: Record<string, unknown>) {
      const { data: created, error } = await supabaseAdmin
        .from("cohorts")
        .insert(data)
        .select()
        .single();
      if (error) throw error;
      return created;
    },
    async update(id: string, data: Record<string, unknown>) {
      const { data: updated, error } = await supabaseAdmin
        .from("cohorts")
        .update(data)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return updated;
    },
  },

  // Cohort Members
  cohortMembers: {
    async findUnique(where: { user_id: string; cohort_id: string }) {
      const { data, error } = await supabaseAdmin
        .from("cohort_members")
        .select("*, cohort:cohorts(*)")
        .eq("user_id", where.user_id)
        .eq("cohort_id", where.cohort_id)
        .single();
      if (error && error.code !== "PGRST116") throw error;
      return data;
    },
    async findByUser(userId: string) {
      const { data, error } = await supabaseAdmin
        .from("cohort_members")
        .select("*, cohort:cohorts(*)")
        .eq("user_id", userId);
      if (error) throw error;
      return data || [];
    },
    async findByCohort(cohortId: string) {
      const { data, error } = await supabaseAdmin
        .from("cohort_members")
        .select("*, user:users(*)")
        .eq("cohort_id", cohortId);
      if (error) throw error;
      return data || [];
    },
    async create(data: Record<string, unknown>) {
      const { data: created, error } = await supabaseAdmin
        .from("cohort_members")
        .insert(data)
        .select()
        .single();
      if (error) throw error;
      return created;
    },
    async update(userId: string, cohortId: string, data: Record<string, unknown>) {
      const { data: updated, error } = await supabaseAdmin
        .from("cohort_members")
        .update(data)
        .eq("user_id", userId)
        .eq("cohort_id", cohortId)
        .select()
        .single();
      if (error) throw error;
      return updated;
    },
  },

  // Submissions
  submissions: {
    async findUnique(where: { user_id: string; cohort_id: string; date_key: string }) {
      const { data, error } = await supabaseAdmin
        .from("submissions")
        .select("*")
        .eq("user_id", where.user_id)
        .eq("cohort_id", where.cohort_id)
        .eq("date_key", where.date_key)
        .single();
      if (error && error.code !== "PGRST116") throw error;
      return data;
    },
    async findMany(where: { user_id?: string; cohort_id?: string; date_key?: string }) {
      let query = supabaseAdmin.from("submissions").select("*");
      if (where.user_id) query = query.eq("user_id", where.user_id);
      if (where.cohort_id) query = query.eq("cohort_id", where.cohort_id);
      if (where.date_key) query = query.eq("date_key", where.date_key);
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    async findByUserAndCohort(userId: string, cohortId: string) {
      const { data, error } = await supabaseAdmin
        .from("submissions")
        .select("*")
        .eq("user_id", userId)
        .eq("cohort_id", cohortId)
        .order("date_key", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    async create(data: Record<string, unknown>) {
      const { data: created, error } = await supabaseAdmin
        .from("submissions")
        .insert(data)
        .select()
        .single();
      if (error) throw error;
      return created;
    },
    async update(id: string, data: Record<string, unknown>) {
      const { data: updated, error } = await supabaseAdmin
        .from("submissions")
        .update(data)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return updated;
    },
    async upsert(
      where: { user_id: string; cohort_id: string; date_key: string },
      data: Record<string, unknown>
    ) {
      const { data: upserted, error } = await supabaseAdmin
        .from("submissions")
        .upsert({ ...where, ...data }, { onConflict: "user_id,cohort_id,date_key" })
        .select()
        .single();
      if (error) throw error;
      return upserted;
    },
  },

  // Subjects
  subjects: {
    async findAll() {
      const { data, error } = await supabaseAdmin
        .from("subjects")
        .select("*")
        .order("group_number")
        .order("transcript_name");
      if (error) throw error;
      return data || [];
    },
    async findUnique(where: { id?: string; subject_code?: string }) {
      const query = supabaseAdmin.from("subjects").select("*");
      if (where.id) query.eq("id", where.id);
      if (where.subject_code) query.eq("subject_code", where.subject_code);
      const { data, error } = await query.single();
      if (error && error.code !== "PGRST116") throw error;
      return data;
    },
    async create(data: Record<string, unknown>) {
      const { data: created, error } = await supabaseAdmin
        .from("subjects")
        .insert(data)
        .select()
        .single();
      if (error) throw error;
      return created;
    },
    async upsert(subjectCode: string, data: Record<string, unknown>) {
      const { data: upserted, error } = await supabaseAdmin
        .from("subjects")
        .upsert({ subject_code: subjectCode, ...data }, { onConflict: "subject_code" })
        .select()
        .single();
      if (error) throw error;
      return upserted;
    },
  },

  // Units
  units: {
    async findBySubject(subjectId: string) {
      const { data, error } = await supabaseAdmin
        .from("units")
        .select("*")
        .eq("subject_id", subjectId)
        .order("order_index");
      if (error) throw error;
      return data || [];
    },
    async findUnique(id: string) {
      const { data, error } = await supabaseAdmin
        .from("units")
        .select("*")
        .eq("id", id)
        .single();
      if (error && error.code !== "PGRST116") throw error;
      return data;
    },
    async create(data: Record<string, unknown>) {
      const { data: created, error } = await supabaseAdmin
        .from("units")
        .insert(data)
        .select()
        .single();
      if (error) throw error;
      return created;
    },
  },

  // User Subjects
  userSubjects: {
    async findByUser(userId: string) {
      const { data, error } = await supabaseAdmin
        .from("user_subjects")
        .select("*, subject:subjects(*)")
        .eq("user_id", userId);
      if (error) throw error;
      return data || [];
    },
    async create(data: Record<string, unknown>) {
      const { data: created, error } = await supabaseAdmin
        .from("user_subjects")
        .insert(data)
        .select()
        .single();
      if (error) throw error;
      return created;
    },
    async deleteByUser(userId: string) {
      const { error } = await supabaseAdmin
        .from("user_subjects")
        .delete()
        .eq("user_id", userId);
      if (error) throw error;
    },
  },

  // Weekly Unit Selections
  weeklyUnitSelections: {
    async findByUserAndWeek(userId: string, weekStartDateKey: string) {
      const { data, error } = await supabaseAdmin
        .from("weekly_unit_selections")
        .select("*, subject:subjects(*), unit:units(*)")
        .eq("user_id", userId)
        .eq("week_start_date_key", weekStartDateKey);
      if (error) throw error;
      return data || [];
    },
    async upsert(
      where: { user_id: string; subject_id: string; week_start_date_key: string },
      data: Record<string, unknown>
    ) {
      const { data: upserted, error } = await supabaseAdmin
        .from("weekly_unit_selections")
        .upsert(
          { ...where, ...data },
          { onConflict: "user_id,subject_id,week_start_date_key" }
        )
        .select()
        .single();
      if (error) throw error;
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
      const { data, error } = await supabaseAdmin
        .from("daily_questions")
        .select("*, subject:subjects(*), unit:units(*)")
        .eq("user_id", where.user_id)
        .eq("cohort_id", where.cohort_id)
        .eq("date_key", where.date_key)
        .eq("subject_id", where.subject_id)
        .single();
      if (error && error.code !== "PGRST116") throw error;
      return data;
    },
    async create(data: Record<string, unknown>) {
      const { data: created, error } = await supabaseAdmin
        .from("daily_questions")
        .insert(data)
        .select()
        .single();
      if (error) throw error;
      return created;
    },
  },

  // Subscriptions
  subscriptions: {
    async findByUser(userId: string) {
      const { data, error } = await supabaseAdmin
        .from("subscriptions")
        .select("*")
        .eq("user_id", userId)
        .single();
      if (error && error.code !== "PGRST116") throw error;
      return data;
    },
    async findByStripeId(stripeSubscriptionId: string) {
      const { data, error } = await supabaseAdmin
        .from("subscriptions")
        .select("*")
        .eq("stripe_subscription_id", stripeSubscriptionId)
        .single();
      if (error && error.code !== "PGRST116") throw error;
      return data;
    },
    async upsert(userId: string, data: Record<string, unknown>) {
      const { data: upserted, error } = await supabaseAdmin
        .from("subscriptions")
        .upsert({ user_id: userId, ...data, updated_at: new Date().toISOString() }, { onConflict: "user_id" })
        .select()
        .single();
      if (error) throw error;
      return upserted;
    },
    async updateByStripeId(stripeSubscriptionId: string, data: Record<string, unknown>) {
      const { data: updated, error } = await supabaseAdmin
        .from("subscriptions")
        .update({ ...data, updated_at: new Date().toISOString() })
        .eq("stripe_subscription_id", stripeSubscriptionId)
        .select()
        .single();
      if (error) throw error;
      return updated;
    },
  },

  // Notification Preferences
  notificationPrefs: {
    async findByUser(userId: string) {
      const { data, error } = await supabaseAdmin
        .from("notification_prefs")
        .select("*")
        .eq("user_id", userId)
        .single();
      if (error && error.code !== "PGRST116") throw error;
      return data;
    },
    async upsert(userId: string, data: Record<string, unknown>) {
      const { data: upserted, error } = await supabaseAdmin
        .from("notification_prefs")
        .upsert({ user_id: userId, ...data, updated_at: new Date().toISOString() }, { onConflict: "user_id" })
        .select()
        .single();
      if (error) throw error;
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
      const { data, error } = await supabaseAdmin
        .from("reminder_logs")
        .select("*")
        .eq("user_id", where.user_id)
        .eq("cohort_id", where.cohort_id)
        .eq("date_key", where.date_key)
        .eq("type", where.type)
        .single();
      if (error && error.code !== "PGRST116") throw error;
      return data;
    },
    async create(data: Record<string, unknown>) {
      const { data: created, error } = await supabaseAdmin
        .from("reminder_logs")
        .insert(data)
        .select()
        .single();
      if (error) throw error;
      return created;
    },
  },

  // AI Feedback Reports
  aiFeedbackReports: {
    async create(data: Record<string, unknown>) {
      const { data: created, error } = await supabaseAdmin
        .from("ai_feedback_reports")
        .insert(data)
        .select()
        .single();
      if (error) throw error;
      return created;
    },
  },
};
