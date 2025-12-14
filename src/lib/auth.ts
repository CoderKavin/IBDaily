import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "./prisma";

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
        if (!credentials?.email || !credentials?.firebaseUid) {
          return null;
        }

        const email = credentials.email as string;
        const firebaseUid = credentials.firebaseUid as string;
        const name = (credentials.name as string) || null;

        // Find or create user based on Firebase UID
        let user = await prisma.user.findUnique({
          where: { email },
        });

        if (!user) {
          // Create new user with Firebase UID
          user = await prisma.user.create({
            data: {
              email,
              firebaseUid,
              name,
              password: "", // Not used with Firebase auth
              onboardingCompleted: false,
            },
          });
        } else if (!user.firebaseUid) {
          // Link existing user to Firebase
          user = await prisma.user.update({
            where: { id: user.id },
            data: { firebaseUid },
          });
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
        };
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
