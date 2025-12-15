import { createClient } from '@supabase/supabase-js';

// Get env vars with defaults for build time
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// Check if we have real credentials (not during build)
export const isSupabaseConfigured = () => {
  return supabaseUrl !== 'https://placeholder.supabase.co' && supabaseAnonKey !== 'placeholder';
};

// Public client for browser
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Admin client for server-side (bypasses RLS)
export const supabaseAdmin = createClient(
  supabaseUrl,
  supabaseServiceKey || supabaseAnonKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);
