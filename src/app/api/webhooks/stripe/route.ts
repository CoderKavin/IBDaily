import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { constructWebhookEvent, getStripeConfig } from "@/lib/stripe";
import { ACTIVATION_THRESHOLD } from "@/lib/cohort-status";

// Disable body parsing - we need raw body for signature verification
export const dynamic = "force-dynamic";

/**
 * Update cohort status based on paid member count
 * Called after subscription changes
 */
async function updateCohortStatuses(userId: string) {
  // Get all cohorts the user is a member of
  const memberships = await prisma.cohortMember.findMany({
    where: { userId },
    select: { cohortId: true },
  });

  for (const { cohortId } of memberships) {
    await recomputeCohortStatus(cohortId);
  }
}

/**
 * Recompute a cohort's status based on current paid member count
 */
async function recomputeCohortStatus(cohortId: string) {
  // Get cohort with members and their subscriptions
  const cohort = await prisma.cohort.findUnique({
    where: { id: cohortId },
    include: {
      members: {
        include: {
          user: {
            include: { subscription: true },
          },
        },
      },
    },
  });

  if (!cohort) return;

  // Count active subscriptions
  const now = new Date();
  const paidCount = cohort.members.filter((m) => {
    const sub = m.user.subscription;
    return sub && sub.status === "active" && sub.currentPeriodEnd > now;
  }).length;

  // Determine if cohort should be activated
  const shouldActivate = paidCount >= ACTIVATION_THRESHOLD;

  // Update cohort status if needed
  if (shouldActivate && cohort.status !== "ACTIVE") {
    await prisma.cohort.update({
      where: { id: cohortId },
      data: {
        status: "ACTIVE",
        activatedAt: new Date(),
      },
    });
    console.log(`Cohort ${cohortId} activated with ${paidCount} paid members`);
  } else if (!shouldActivate && cohort.status === "LOCKED") {
    // Check if we have enough paid members to unlock
    // (cohort was locked but now has >= 6 paid)
    // This case is already handled by shouldActivate above
  }
  // Note: We don't automatically lock cohorts here - that happens on status check
}

/**
 * Handle subscription created/updated
 */
async function handleSubscriptionChange(subscription: Stripe.Subscription) {
  const userId = subscription.metadata.userId;

  if (!userId) {
    console.error("No userId in subscription metadata");
    return;
  }

  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer.id;

  // Get current period end - handle both snake_case and camelCase from different API versions
  const subAny = subscription as unknown as Record<string, unknown>;
  const periodEndTimestamp =
    (subAny.current_period_end as number) ||
    (subAny.currentPeriodEnd as number) ||
    Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60; // fallback: 30 days

  // Upsert subscription record
  await prisma.subscription.upsert({
    where: { stripeSubscriptionId: subscription.id },
    update: {
      status: subscription.status,
      currentPeriodEnd: new Date(periodEndTimestamp * 1000),
      updatedAt: new Date(),
    },
    create: {
      userId,
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscription.id,
      status: subscription.status,
      currentPeriodEnd: new Date(periodEndTimestamp * 1000),
    },
  });

  console.log(
    `Subscription ${subscription.id} updated: ${subscription.status}`,
  );

  // Update cohort statuses for this user
  await updateCohortStatuses(userId);
}

/**
 * Handle subscription deleted
 */
async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  // Update subscription status to canceled
  await prisma.subscription.update({
    where: { stripeSubscriptionId: subscription.id },
    data: {
      status: "canceled",
      updatedAt: new Date(),
    },
  });

  console.log(`Subscription ${subscription.id} deleted/canceled`);

  // Get userId from subscription record
  const subRecord = await prisma.subscription.findUnique({
    where: { stripeSubscriptionId: subscription.id },
  });

  if (subRecord) {
    await updateCohortStatuses(subRecord.userId);
  }
}

/**
 * Handle checkout session completed
 */
async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const userId = session.metadata?.userId;

  if (!userId) {
    console.error("No userId in checkout session metadata");
    return;
  }

  // The subscription webhook will handle the actual subscription creation
  console.log(`Checkout completed for user ${userId}`);
}

export async function POST(request: NextRequest) {
  const config = getStripeConfig();

  if (!config.webhookSecret) {
    console.error("STRIPE_WEBHOOK_SECRET is not configured");
    return NextResponse.json(
      { error: "Webhook not configured" },
      { status: 500 },
    );
  }

  // Get raw body for signature verification
  const body = await request.text();
  const headersList = await headers();
  const signature = headersList.get("stripe-signature");

  if (!signature) {
    return NextResponse.json(
      { error: "Missing stripe-signature header" },
      { status: 400 },
    );
  }

  let event: Stripe.Event;

  try {
    event = constructWebhookEvent(body, signature, config.webhookSecret);
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  // Handle the event
  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(
          event.data.object as Stripe.Checkout.Session,
        );
        break;

      case "customer.subscription.created":
      case "customer.subscription.updated":
        await handleSubscriptionChange(
          event.data.object as Stripe.Subscription,
        );
        break;

      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(
          event.data.object as Stripe.Subscription,
        );
        break;

      case "invoice.payment_succeeded":
        // Subscription payment succeeded - subscription webhook handles status
        console.log("Invoice payment succeeded:", event.data.object.id);
        break;

      case "invoice.payment_failed":
        // Payment failed - subscription status will be updated via subscription webhook
        console.log("Invoice payment failed:", event.data.object.id);
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Error processing webhook:", error);
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 },
    );
  }
}
