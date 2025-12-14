import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isStripeConfigured } from "@/lib/stripe";
import { isSubscriptionActive } from "@/lib/cohort-status";

// GET - get user's subscription status
export async function GET() {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { subscription: true },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const isActive = isSubscriptionActive(user.subscription);

  return NextResponse.json({
    stripeConfigured: isStripeConfigured(),
    subscription: user.subscription
      ? {
          status: user.subscription.status,
          currentPeriodEnd: user.subscription.currentPeriodEnd,
          isActive,
        }
      : null,
    hasSubscription: !!user.subscription,
    isActive,
  });
}
