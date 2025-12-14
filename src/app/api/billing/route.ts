import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { isStripeConfigured } from "@/lib/stripe";
import { isSubscriptionActive } from "@/lib/cohort-status";

// GET - get user's subscription status
export async function GET() {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await db.users.findUnique({ id: session.user.id });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const subscription = await db.subscriptions.findByUser(session.user.id);

  const isActive = isSubscriptionActive(subscription ? {
    status: subscription.status,
    currentPeriodEnd: new Date(subscription.current_period_end),
  } : null);

  return NextResponse.json({
    stripeConfigured: isStripeConfigured(),
    subscription: subscription
      ? {
          status: subscription.status,
          currentPeriodEnd: subscription.current_period_end,
          isActive,
        }
      : null,
    hasSubscription: !!subscription,
    isActive,
  });
}
