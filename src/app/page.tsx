import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export default async function Home() {
  const session = await auth();

  if (!session) {
    redirect("/auth");
  }

  // Check if user has completed onboarding
  const user = await db.users.findUnique({ id: session.user.id });

  if (!user?.onboarding_completed) {
    redirect("/onboarding");
  }

  redirect("/cohort");
}
