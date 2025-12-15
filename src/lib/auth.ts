import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { getSupabaseAdmin, isSupabaseConfigured } from "./supabase";

/**
 * NextAuth configuration with Firebase credentials provider
 * Users authenticate via Firebase, then we create/link their account in Supabase
 */

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      id: "firebase",
      name: "Firebase",
      credentials: {
        email: { label: "Email", type: "email" },
        firebaseUid: { label: "Firebase UID", type: "text" },
        name: { label: "Name", type: "text" },
      },
      async authorize(credentials) {
        try {
          // Validate inputs
          if (!credentials?.email || !credentials?.firebaseUid) {
            console.error("[Auth] Missing email or firebaseUid");
            return null;
          }

          // Check if Supabase is configured
          if (!isSupabaseConfigured()) {
            console.error("[Auth] Supabase is not configured");
            return null;
          }

          const email = credentials.email as string;
          const firebaseUid = credentials.firebaseUid as string;
          const name = (credentials.name as string) || null;

          const supabase = getSupabaseAdmin();

          // Try to find existing user by email
          const { data: existingUser, error: findError } = await supabase
            .from("users")
            .select("*")
            .eq("email", email)
            .maybeSingle();

          if (findError) {
            console.error("[Auth] Error finding user:", findError.message);
            return null;
          }

          let user = existingUser;

          // Create new user if doesn't exist
          if (!user) {
            const { data: newUser, error: createError } = await supabase
              .from("users")
              .insert({
                email,
                firebase_uid: firebaseUid,
                name,
                onboarding_completed: false,
                onboarding_step: 0,
              })
              .select()
              .single();

            if (createError) {
              console.error("[Auth] Error creating user:", createError.message);
              return null;
            }

            user = newUser;
            console.log("[Auth] Created new user:", user.id);
          } else if (!user.firebase_uid) {
            // Link Firebase UID to existing user if not already linked
            const { error: updateError } = await supabase
              .from("users")
              .update({ firebase_uid: firebaseUid })
              .eq("id", user.id);

            if (updateError) {
              console.error("[Auth] Error linking Firebase UID:", updateError.message);
              // Don't fail - user can still proceed
            }
          }

          // Return user object for session
          return {
            id: user.id,
            email: user.email,
            name: user.name,
          };
        } catch (error) {
          console.error("[Auth] Unexpected error during authorize:", error);
          return null;
        }
      },
    }),
  ],
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  callbacks: {
    async jwt({ token, user }) {
      // Add user id to token on first sign in
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      // Add user id to session
      if (session.user && token.id) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
  pages: {
    signIn: "/auth",
    error: "/auth",
  },
  debug: process.env.NODE_ENV === "development",
});
