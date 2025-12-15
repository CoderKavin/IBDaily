import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * Supabase client configuration
 * Handles build-time and runtime initialization safely
 */

// Environment variables with safe defaults for build time
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// Check if Supabase is properly configured
export function isSupabaseConfigured(): boolean {
  return Boolean(supabaseUrl && supabaseAnonKey && supabaseUrl.includes('supabase.co'));
}

// Lazy-initialized clients
let _supabase: SupabaseClient | null = null;
let _supabaseAdmin: SupabaseClient | null = null;

/**
 * Get the public Supabase client (for browser/client-side)
 * Uses anon key with RLS
 */
export function getSupabase(): SupabaseClient {
  if (!_supabase) {
    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Supabase is not configured. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY');
    }
    _supabase = createClient(supabaseUrl, supabaseAnonKey);
  }
  return _supabase;
}

/**
 * Get the admin Supabase client (for server-side only)
 * Uses service role key to bypass RLS
 */
export function getSupabaseAdmin(): SupabaseClient {
  if (!_supabaseAdmin) {
    if (!supabaseUrl) {
      throw new Error('Supabase URL is not configured');
    }
    // Use service key if available, fallback to anon key
    const key = supabaseServiceKey || supabaseAnonKey;
    if (!key) {
      throw new Error('No Supabase key available');
    }
    _supabaseAdmin = createClient(supabaseUrl, key, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }
  return _supabaseAdmin;
}

// Export getters as properties for backward compatibility
// These are safe to use in module scope as they create clients lazily
export const supabase = {
  get client() {
    return getSupabase();
  },
};

export const supabaseAdmin = {
  get from() {
    return getSupabaseAdmin().from.bind(getSupabaseAdmin());
  },
  get rpc() {
    return getSupabaseAdmin().rpc.bind(getSupabaseAdmin());
  },
  get auth() {
    return getSupabaseAdmin().auth;
  },
};
