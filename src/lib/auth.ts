import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { supabaseAdmin, isSupabaseConfigured } from "./supabase";

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      name: "firebase",
      credentials: {
        email: { label: "Email", type: "email" },
        firebaseUid: { label: "Firebase UID", type: "text" },
        name: { label: "Name", type: "text" },
      },
      async authorize(credentials) {
        // Check if Supabase is configured
        if (!isSupabaseConfigured()) {
          console.error("Auth: Supabase not configured");
          return null;
        }

        if (!credentials?.email || !credentials?.firebaseUid) {
          console.error("Auth: Missing email or firebaseUid");
          return null;
        }

        const email = credentials.email as string;
        const firebaseUid = credentials.firebaseUid as string;
        const name = (credentials.name as string) || null;

        try {
          // Try to find existing user
          const { data: existingUser, error: findError } = await supabaseAdmin
            .from("users")
            .select("*")
            .eq("email", email)
            .maybeSingle();

          if (findError) {
            console.error("Auth: Error finding user:", findError.message);
            return null;
          }

          let user = existingUser;

          if (!user) {
            // Create new user
            const { data: newUser, error: createError } = await supabaseAdmin
              .from("users")
              .insert({
                email,
                firebase_uid: firebaseUid,
                name,
              })
              .select()
              .single();

            if (createError) {
              console.error("Auth: Error creating user:", createError.message);
              return null;
            }

            user = newUser;
            console.log("Auth: Created new user:", user.id);
          } else if (!user.firebase_uid) {
            // Link Firebase UID to existing user
            const { error: updateError } = await supabaseAdmin
              .from("users")
              .update({ firebase_uid: firebaseUid })
              .eq("id", user.id);

            if (updateError) {
              console.error("Auth: Error linking Firebase:", updateError.message);
              return null;
            }
          }

          return {
            id: user.id,
            email: user.email,
            name: user.name,
          };
        } catch (error) {
          console.error("Auth: Unexpected error:", error);
          return null;
        }
      },
    }),
  ],
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
  pages: {
    signIn: "/auth",
  },
});
