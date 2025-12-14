-- Add Subscription table
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "stripeCustomerId" TEXT NOT NULL,
    "stripeSubscriptionId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "currentPeriodEnd" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Subscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Add unique indexes for Subscription
CREATE UNIQUE INDEX "Subscription_userId_key" ON "Subscription"("userId");
CREATE UNIQUE INDEX "Subscription_stripeSubscriptionId_key" ON "Subscription"("stripeSubscriptionId");
CREATE INDEX "Subscription_stripeSubscriptionId_idx" ON "Subscription"("stripeSubscriptionId");
CREATE INDEX "Subscription_status_idx" ON "Subscription"("status");

-- Add stripeCustomerId to User
ALTER TABLE "User" ADD COLUMN "stripeCustomerId" TEXT;
CREATE UNIQUE INDEX "User_stripeCustomerId_key" ON "User"("stripeCustomerId");

-- Add status, trialEndsAt, activatedAt to Cohort
-- First add with defaults for existing rows
ALTER TABLE "Cohort" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'TRIAL';
ALTER TABLE "Cohort" ADD COLUMN "trialEndsAt" DATETIME NOT NULL DEFAULT (datetime('now', '+14 days'));
ALTER TABLE "Cohort" ADD COLUMN "activatedAt" DATETIME;

-- Add role to CohortMember
ALTER TABLE "CohortMember" ADD COLUMN "role" TEXT NOT NULL DEFAULT 'MEMBER';
