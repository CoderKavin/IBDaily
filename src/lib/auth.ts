import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { supabaseAdmin } from "./supabase";

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
        try {
          if (!credentials?.email || !credentials?.firebaseUid) {
            console.error("Auth: Missing email or firebaseUid");
            return null;
          }

          const email = credentials.email as string;
          const firebaseUid = credentials.firebaseUid as string;
          const name = (credentials.name as string) || null;

          // Find user by email
          const { data: existingUser, error: findError } = await supabaseAdmin
            .from("users")
            .select("*")
            .eq("email", email)
            .single();

          if (findError && findError.code !== "PGRST116") {
            // PGRST116 = no rows found, which is fine for new users
            console.error("Auth: Error finding user:", findError);
            return null;
          }

          let user = existingUser;

          if (!user) {
            // Create new user with Firebase UID
            const { data: newUser, error: createError } = await supabaseAdmin
              .from("users")
              .insert({
                email,
                firebase_uid: firebaseUid,
                name,
                password: "",
                onboarding_completed: false,
                onboarding_step: 0,
              })
              .select()
              .single();

            if (createError) {
              console.error("Auth: Error creating user:", createError);
              return null;
            }

            user = newUser;
          } else if (!user.firebase_uid) {
            // Link existing user to Firebase
            const { data: updatedUser, error: updateError } = await supabaseAdmin
              .from("users")
              .update({ firebase_uid: firebaseUid })
              .eq("id", user.id)
              .select()
              .single();

            if (updateError) {
              console.error("Auth: Error linking Firebase:", updateError);
              return null;
            }

            user = updatedUser;
          }

          return {
            id: user.id,
            email: user.email,
            name: user.name,
          };
        } catch (error) {
          console.error("Auth authorize error:", error);
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
