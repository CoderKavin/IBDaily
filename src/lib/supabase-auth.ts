import { createClient, SupabaseClient } from "@supabase/supabase-js";

/**
 * Supabase Auth client for browser-side authentication
 * This uses the anon key and handles user sign up/sign in
 */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

// Lazy-initialized auth client
let _authClient: SupabaseClient | null = null;

function getAuthClient(): SupabaseClient {
  if (!_authClient) {
    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error("Supabase is not configured");
    }
    _authClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    });
  }
  return _authClient;
}

export async function signUpWithEmail(email: string, password: string) {
  const supabase = getAuthClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  });

  if (error) {
    throw error;
  }

  return data;
}

export async function signInWithEmail(email: string, password: string) {
  const supabase = getAuthClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    throw error;
  }

  return data;
}

export async function signOut() {
  const supabase = getAuthClient();
  const { error } = await supabase.auth.signOut();
  if (error) {
    throw error;
  }
}

export async function getCurrentUser() {
  const supabase = getAuthClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error) {
    throw error;
  }
  return user;
}

export async function getSession() {
  const supabase = getAuthClient();
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();
  if (error) {
    throw error;
  }
  return session;
}
