/**
 * Stripe client and utilities
 * Gracefully handles missing Stripe configuration
 */

import Stripe from "stripe";

// Check if Stripe is configured
export function isStripeConfigured(): boolean {
  return !!(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_PRICE_ID);
}

// Get Stripe client (throws if not configured)
let stripeClient: Stripe | null = null;

export function getStripe(): Stripe {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY is not configured");
  }

  if (!stripeClient) {
    stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2025-11-17.clover",
      typescript: true,
    });
  }

  return stripeClient;
}

// Get required environment variables
export function getStripeConfig() {
  return {
    secretKey: process.env.STRIPE_SECRET_KEY || "",
    priceId: process.env.STRIPE_PRICE_ID || "",
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || "",
    publicKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || "",
  };
}

/**
 * Create or retrieve a Stripe customer for a user
 */
export async function getOrCreateStripeCustomer(
  userId: string,
  email: string,
  existingCustomerId?: string | null,
): Promise<string> {
  const stripe = getStripe();

  // If customer already exists, return their ID
  if (existingCustomerId) {
    return existingCustomerId;
  }

  // Create a new customer
  const customer = await stripe.customers.create({
    email,
    metadata: {
      userId,
    },
  });

  return customer.id;
}

/**
 * Create a Stripe Checkout session for subscription
 */
export async function createCheckoutSession(params: {
  customerId: string;
  priceId: string;
  successUrl: string;
  cancelUrl: string;
  userId: string;
}): Promise<Stripe.Checkout.Session> {
  const stripe = getStripe();

  const session = await stripe.checkout.sessions.create({
    customer: params.customerId,
    mode: "subscription",
    payment_method_types: ["card"],
    line_items: [
      {
        price: params.priceId,
        quantity: 1,
      },
    ],
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
    metadata: {
      userId: params.userId,
    },
    subscription_data: {
      metadata: {
        userId: params.userId,
      },
    },
  });

  return session;
}

/**
 * Construct and verify a webhook event
 */
export function constructWebhookEvent(
  payload: string | Buffer,
  signature: string,
  webhookSecret: string,
): Stripe.Event {
  const stripe = getStripe();
  return stripe.webhooks.constructEvent(payload, signature, webhookSecret);
}

/**
 * Cancel a subscription
 */
export async function cancelSubscription(
  subscriptionId: string,
): Promise<Stripe.Subscription> {
  const stripe = getStripe();
  return stripe.subscriptions.cancel(subscriptionId);
}

/**
 * Get subscription details
 */
export async function getSubscription(
  subscriptionId: string,
): Promise<Stripe.Subscription> {
  const stripe = getStripe();
  return stripe.subscriptions.retrieve(subscriptionId);
}

/**
 * Create a billing portal session for managing subscription
 */
export async function createBillingPortalSession(params: {
  customerId: string;
  returnUrl: string;
}): Promise<Stripe.BillingPortal.Session> {
  const stripe = getStripe();

  return stripe.billingPortal.sessions.create({
    customer: params.customerId,
    return_url: params.returnUrl,
  });
}
