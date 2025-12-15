import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import Stripe from "stripe";
import { db } from "@/lib/db";
import { getSupabaseAdmin } from "@/lib/supabase";
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
  const memberships = await db.cohortMembers.findByUser(userId);

  for (const membership of memberships) {
    await recomputeCohortStatus(membership.cohort_id);
  }
}

/**
 * Recompute a cohort's status based on current paid member count
 */
async function recomputeCohortStatus(cohortId: string) {
  const supabase = getSupabaseAdmin();

  // Get cohort
  const { data: cohort } = await supabase
    .from("cohorts")
    .select("*")
    .eq("id", cohortId)
    .maybeSingle();

  if (!cohort) return;

  // Get members
  const members = await db.cohortMembers.findByCohort(cohortId);

  // Count active subscriptions
  const now = new Date();
  let paidCount = 0;
  for (const member of members) {
    const sub = await db.subscriptions.findByUser(member.user_id);
    if (sub && sub.status === "active" && new Date(sub.current_period_end) > now) {
      paidCount++;
    }
  }

  // Determine if cohort should be activated
  const shouldActivate = paidCount >= ACTIVATION_THRESHOLD;

  // Update cohort status if needed
  if (shouldActivate && cohort.status !== "ACTIVE") {
    await supabase
      .from("cohorts")
      .update({
        status: "ACTIVE",
        activated_at: new Date().toISOString(),
      })
      .eq("id", cohortId);
    console.log(`Cohort ${cohortId} activated with ${paidCount} paid members`);
  }
}

/**
 * Handle subscription created/updated
 */
async function handleSubscriptionChange(subscription: Stripe.Subscription) {
  const supabase = getSupabaseAdmin();
  const userId = subscription.metadata.userId;

  if (!userId) {
    console.error("No userId in subscription metadata");
    return;
  }

  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer.id;

  // Get current period end
  const subAny = subscription as unknown as Record<string, unknown>;
  const periodEndTimestamp =
    (subAny.current_period_end as number) ||
    (subAny.currentPeriodEnd as number) ||
    Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;

  // Upsert subscription record
  const { data: existing } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("stripe_subscription_id", subscription.id)
    .maybeSingle();

  if (existing) {
    await supabase
      .from("subscriptions")
      .update({
        status: subscription.status,
        current_period_end: new Date(periodEndTimestamp * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("stripe_subscription_id", subscription.id);
  } else {
    await supabase.from("subscriptions").insert({
      user_id: userId,
      stripe_customer_id: customerId,
      stripe_subscription_id: subscription.id,
      status: subscription.status,
      current_period_end: new Date(periodEndTimestamp * 1000).toISOString(),
    });
  }

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
  const supabase = getSupabaseAdmin();

  // Update subscription status to canceled
  await supabase
    .from("subscriptions")
    .update({
      status: "canceled",
      updated_at: new Date().toISOString(),
    })
    .eq("stripe_subscription_id", subscription.id);

  console.log(`Subscription ${subscription.id} deleted/canceled`);

  // Get userId from subscription record
  const { data: subRecord } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("stripe_subscription_id", subscription.id)
    .maybeSingle();

  if (subRecord) {
    await updateCohortStatuses(subRecord.user_id);
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
        console.log("Invoice payment succeeded:", event.data.object.id);
        break;

      case "invoice.payment_failed":
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
