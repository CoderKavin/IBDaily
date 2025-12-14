import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  isStripeConfigured,
  getStripeConfig,
  getOrCreateStripeCustomer,
  createCheckoutSession,
} from "@/lib/stripe";

// POST - create a Stripe checkout session
export async function POST(request: NextRequest) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check if Stripe is configured
  if (!isStripeConfigured()) {
    return NextResponse.json(
      { error: "Payment system is not configured" },
      { status: 503 }
    );
  }

  const config = getStripeConfig();

  try {
    // Get user with current subscription status
    const user = await db.users.findUnique({ id: session.user.id });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const subscription = await db.subscriptions.findByUser(session.user.id);

    // Check if user already has an active subscription
    if (
      subscription?.status === "active" &&
      new Date(subscription.current_period_end) > new Date()
    ) {
      return NextResponse.json(
        { error: "You already have an active subscription" },
        { status: 400 }
      );
    }

    // Get or create Stripe customer
    const customerId = await getOrCreateStripeCustomer(
      user.id,
      user.email,
      user.stripe_customer_id
    );

    // Update user with Stripe customer ID if new
    if (!user.stripe_customer_id) {
      await db.users.update(user.id, { stripe_customer_id: customerId });
    }

    // Get origin for redirect URLs
    const origin = request.headers.get("origin") || "http://localhost:3000";

    // Create checkout session
    const checkoutSession = await createCheckoutSession({
      customerId,
      priceId: config.priceId,
      successUrl: `${origin}/billing?success=true`,
      cancelUrl: `${origin}/billing?canceled=true`,
      userId: user.id,
    });

    return NextResponse.json({
      sessionId: checkoutSession.id,
      url: checkoutSession.url,
    });
  } catch (error) {
    console.error("Checkout error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Checkout failed" },
      { status: 500 }
    );
  }
}
