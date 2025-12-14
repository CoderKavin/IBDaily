import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// Lazy initialization to avoid build-time errors
let _supabase: SupabaseClient | null = null;
let _supabaseAdmin: SupabaseClient | null = null;

function getSupabaseClient(): SupabaseClient {
  if (!_supabase) {
    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Supabase URL and Anon Key are required');
    }
    _supabase = createClient(supabaseUrl, supabaseAnonKey);
  }
  return _supabase;
}

function getSupabaseAdmin(): SupabaseClient {
  if (!_supabaseAdmin) {
    if (!supabaseUrl) {
      throw new Error('Supabase URL is required');
    }
    _supabaseAdmin = createClient(
      supabaseUrl,
      supabaseServiceKey || supabaseAnonKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );
  }
  return _supabaseAdmin;
}

// Export getters that lazily initialize
export const supabase = new Proxy({} as SupabaseClient, {
  get(_, prop) {
    return (getSupabaseClient() as unknown as Record<string, unknown>)[prop as string];
  },
});

export const supabaseAdmin = new Proxy({} as SupabaseClient, {
  get(_, prop) {
    return (getSupabaseAdmin() as unknown as Record<string, unknown>)[prop as string];
  },
});

// Helper to generate CUID-like IDs
export function generateId(): string {
  return crypto.randomUUID();
}

// Types matching our schema
export interface User {
  id: string;
  email: string;
  password: string;
  firebase_uid: string | null;
  name: string | null;
  onboarding_completed: boolean;
  onboarding_step: number;
  active_cohort_id: string | null;
  stripe_customer_id: string | null;
  show_exact_rank: boolean;
  created_at: string;
}

export interface Cohort {
  id: string;
  name: string;
  join_code: string;
  status: string;
  trial_ends_at: string;
  activated_at: string | null;
  created_at: string;
}

export interface CohortMember {
  id: string;
  user_id: string;
  cohort_id: string;
  role: string;
  joined_at: string;
  best_streak: number;
  best_rank: number | null;
}

export interface Submission {
  id: string;
  user_id: string;
  cohort_id: string;
  date_key: string;
  subject_id: string | null;
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
}

export interface WeeklyUnitSelection {
  id: string;
  user_id: string;
  subject_id: string;
  unit_id: string;
  week_start_date_key: string;
  created_at: string;
}

export interface DailyQuestion {
  id: string;
  user_id: string;
  cohort_id: string;
  date_key: string;
  subject_id: string;
  level: string;
  unit_id: string | null;
  difficulty_rung: number;
  question_text: string;
  marking_guide_text: string;
  common_mistakes_text: string;
  created_at: string;
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
  quiet_hours_start: number | null;
  quiet_hours_end: number | null;
  created_at: string;
  updated_at: string;
}

export interface ReminderLog {
  id: string;
  user_id: string;
  cohort_id: string;
  date_key: string;
  type: string;
  sent_at: string;
}

export interface AIFeedbackReport {
  id: string;
  user_id: string;
  submission_id: string;
  reason: string;
  notes: string | null;
  created_at: string;
}
