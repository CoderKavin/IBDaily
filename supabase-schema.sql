-- IBDaily Database Schema for Supabase
-- Run this in Supabase SQL Editor

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password TEXT DEFAULT '',
  firebase_uid TEXT UNIQUE,
  name TEXT,
  onboarding_completed BOOLEAN DEFAULT FALSE,
  onboarding_step INTEGER DEFAULT 0,
  active_cohort_id UUID,
  stripe_customer_id TEXT UNIQUE,
  show_exact_rank BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Cohorts table
CREATE TABLE IF NOT EXISTS cohorts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  join_code TEXT UNIQUE NOT NULL,
  status TEXT DEFAULT 'TRIAL',
  trial_ends_at TIMESTAMPTZ NOT NULL,
  activated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Cohort members table
CREATE TABLE IF NOT EXISTS cohort_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  cohort_id UUID NOT NULL REFERENCES cohorts(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'MEMBER',
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  best_streak INTEGER DEFAULT 0,
  best_rank INTEGER,
  UNIQUE(user_id, cohort_id)
);

-- Submissions table
CREATE TABLE IF NOT EXISTS submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  cohort_id UUID NOT NULL REFERENCES cohorts(id) ON DELETE CASCADE,
  date_key TEXT NOT NULL,
  subject_id UUID,
  subject TEXT NOT NULL,
  bullet1 TEXT NOT NULL,
  bullet2 TEXT NOT NULL,
  bullet3 TEXT NOT NULL,
  quality_status TEXT DEFAULT 'GOOD',
  quality_reasons TEXT DEFAULT '[]',
  feedback_hidden BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, cohort_id, date_key)
);

-- Subjects table (IB subject catalog)
CREATE TABLE IF NOT EXISTS subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_code TEXT UNIQUE NOT NULL,
  transcript_name TEXT NOT NULL,
  full_name TEXT NOT NULL,
  group_name TEXT NOT NULL,
  group_number INTEGER NOT NULL,
  sl_available BOOLEAN DEFAULT TRUE,
  hl_available BOOLEAN DEFAULT TRUE,
  has_units BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Units table
CREATE TABLE IF NOT EXISTS units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  order_index INTEGER NOT NULL,
  level_scope TEXT DEFAULT 'BOTH',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(subject_id, order_index)
);

-- User subjects table
CREATE TABLE IF NOT EXISTS user_subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  level TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, subject_id)
);

-- Weekly unit selections table
CREATE TABLE IF NOT EXISTS weekly_unit_selections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  unit_id UUID NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  week_start_date_key TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, subject_id, week_start_date_key)
);

-- Daily questions table
CREATE TABLE IF NOT EXISTS daily_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  cohort_id UUID NOT NULL REFERENCES cohorts(id) ON DELETE CASCADE,
  date_key TEXT NOT NULL,
  subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  level TEXT NOT NULL,
  unit_id UUID REFERENCES units(id) ON DELETE SET NULL,
  difficulty_rung INTEGER NOT NULL,
  question_text TEXT NOT NULL,
  marking_guide_text TEXT NOT NULL,
  common_mistakes_text TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, cohort_id, date_key, subject_id)
);

-- Subscriptions table
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  stripe_customer_id TEXT NOT NULL,
  stripe_subscription_id TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL,
  current_period_end TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Notification preferences table
CREATE TABLE IF NOT EXISTS notification_prefs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  is_enabled BOOLEAN DEFAULT TRUE,
  remind_time_minutes_before_cutoff INTEGER DEFAULT 90,
  last_call_minutes_before_cutoff INTEGER DEFAULT 15,
  quiet_hours_start INTEGER,
  quiet_hours_end INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Reminder logs table
CREATE TABLE IF NOT EXISTS reminder_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  cohort_id UUID NOT NULL,
  date_key TEXT NOT NULL,
  type TEXT NOT NULL,
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, cohort_id, date_key, type)
);

-- AI feedback reports table
CREATE TABLE IF NOT EXISTS ai_feedback_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  submission_id UUID NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_cohort_members_user ON cohort_members(user_id);
CREATE INDEX IF NOT EXISTS idx_cohort_members_cohort ON cohort_members(cohort_id);
CREATE INDEX IF NOT EXISTS idx_submissions_cohort_date ON submissions(cohort_id, date_key);
CREATE INDEX IF NOT EXISTS idx_submissions_quality ON submissions(quality_status);
CREATE INDEX IF NOT EXISTS idx_user_subjects_user ON user_subjects(user_id);
CREATE INDEX IF NOT EXISTS idx_units_subject ON units(subject_id);
CREATE INDEX IF NOT EXISTS idx_daily_questions_user_date ON daily_questions(user_id, date_key);
CREATE INDEX IF NOT EXISTS idx_reminder_logs_date_type ON reminder_logs(date_key, type);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);

-- Disable RLS for now (enable later for security)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE cohorts ENABLE ROW LEVEL SECURITY;
ALTER TABLE cohort_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE units ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_unit_selections ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_prefs ENABLE ROW LEVEL SECURITY;
ALTER TABLE reminder_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_feedback_reports ENABLE ROW LEVEL SECURITY;

-- Create policies that allow service role full access
CREATE POLICY "Service role has full access to users" ON users FOR ALL USING (true);
CREATE POLICY "Service role has full access to cohorts" ON cohorts FOR ALL USING (true);
CREATE POLICY "Service role has full access to cohort_members" ON cohort_members FOR ALL USING (true);
CREATE POLICY "Service role has full access to submissions" ON submissions FOR ALL USING (true);
CREATE POLICY "Service role has full access to subjects" ON subjects FOR ALL USING (true);
CREATE POLICY "Service role has full access to units" ON units FOR ALL USING (true);
CREATE POLICY "Service role has full access to user_subjects" ON user_subjects FOR ALL USING (true);
CREATE POLICY "Service role has full access to weekly_unit_selections" ON weekly_unit_selections FOR ALL USING (true);
CREATE POLICY "Service role has full access to daily_questions" ON daily_questions FOR ALL USING (true);
CREATE POLICY "Service role has full access to subscriptions" ON subscriptions FOR ALL USING (true);
CREATE POLICY "Service role has full access to notification_prefs" ON notification_prefs FOR ALL USING (true);
CREATE POLICY "Service role has full access to reminder_logs" ON reminder_logs FOR ALL USING (true);
CREATE POLICY "Service role has full access to ai_feedback_reports" ON ai_feedback_reports FOR ALL USING (true);
