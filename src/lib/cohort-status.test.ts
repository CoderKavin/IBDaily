/**
 * Tests for cohort status logic
 */

import {
  computeCohortStatus,
  isSubscriptionActive,
  computeTrialEndDate,
  getActivationCounterText,
} from "./cohort-status";

function createDate(daysFromNow: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d;
}

// Test computeCohortStatus
console.log("=== Testing computeCohortStatus ===\n");

// Test 1: New cohort in TRIAL
{
  const result = computeCohortStatus({
    currentStatus: "TRIAL",
    trialEndsAt: createDate(14),
    activatedAt: null,
    paidCount: 0,
    memberCount: 2,
  });
  console.assert(result.status === "TRIAL", "New cohort should be TRIAL");
  console.assert(
    result.canSubmit === true,
    "TRIAL cohort should allow submissions",
  );
  console.assert(
    result.showActivationCounter === false,
    "Counter hidden when paidCount < 4",
  );
  console.log("1. New cohort in TRIAL: PASS");
}

// Test 2: Cohort with 4 paid members (counter visible)
{
  const result = computeCohortStatus({
    currentStatus: "TRIAL",
    trialEndsAt: createDate(10),
    activatedAt: null,
    paidCount: 4,
    memberCount: 8,
  });
  console.assert(
    result.status === "TRIAL",
    "Should still be TRIAL with 4 paid",
  );
  console.assert(
    result.showActivationCounter === true,
    "Counter should show when paidCount >= 4",
  );
  console.log("2. Cohort with 4 paid members: PASS");
}

// Test 3: Cohort reaches 6 paid members -> ACTIVE
{
  const result = computeCohortStatus({
    currentStatus: "TRIAL",
    trialEndsAt: createDate(5),
    activatedAt: null,
    paidCount: 6,
    memberCount: 10,
  });
  console.assert(
    result.status === "ACTIVE",
    "Should become ACTIVE with 6 paid",
  );
  console.assert(
    result.canSubmit === true,
    "ACTIVE cohort should allow submissions",
  );
  console.log("3. Cohort reaches 6 paid -> ACTIVE: PASS");
}

// Test 4: Trial expired without activation -> LOCKED
{
  const result = computeCohortStatus({
    currentStatus: "TRIAL",
    trialEndsAt: createDate(-1), // Expired yesterday
    activatedAt: null,
    paidCount: 3,
    memberCount: 5,
  });
  console.assert(
    result.status === "LOCKED",
    "Should be LOCKED when trial expired",
  );
  console.assert(
    result.canSubmit === false,
    "LOCKED cohort should NOT allow submissions",
  );
  console.assert(
    result.isTrialExpired === true,
    "isTrialExpired should be true",
  );
  console.log("4. Trial expired without activation -> LOCKED: PASS");
}

// Test 5: Already ACTIVE stays ACTIVE even if paidCount drops
{
  const result = computeCohortStatus({
    currentStatus: "ACTIVE",
    trialEndsAt: createDate(-30),
    activatedAt: createDate(-20),
    paidCount: 2, // Dropped below threshold
    memberCount: 10,
  });
  console.assert(result.status === "ACTIVE", "ACTIVE should stay ACTIVE");
  console.assert(result.canSubmit === true, "Should still allow submissions");
  console.log("5. ACTIVE stays ACTIVE (permanent): PASS");
}

// Test 6: LOCKED cohort can be reactivated with 6 paid
{
  const result = computeCohortStatus({
    currentStatus: "LOCKED",
    trialEndsAt: createDate(-5),
    activatedAt: null,
    paidCount: 6,
    memberCount: 10,
  });
  console.assert(
    result.status === "ACTIVE",
    "LOCKED can become ACTIVE with 6 paid",
  );
  console.log("6. LOCKED reactivated with 6 paid: PASS");
}

// Test 7: Days until trial end calculation
{
  const result = computeCohortStatus({
    currentStatus: "TRIAL",
    trialEndsAt: createDate(7),
    activatedAt: null,
    paidCount: 0,
    memberCount: 2,
  });
  console.assert(
    result.daysUntilTrialEnd >= 6 && result.daysUntilTrialEnd <= 8,
    "Days until trial end should be ~7",
  );
  console.log("7. Days until trial end: PASS");
}

// Test isSubscriptionActive
console.log("\n=== Testing isSubscriptionActive ===\n");

// Test 8: Active subscription
{
  const result = isSubscriptionActive({
    status: "active",
    currentPeriodEnd: createDate(30),
  });
  console.assert(result === true, "Active subscription should return true");
  console.log("8. Active subscription: PASS");
}

// Test 9: Expired subscription
{
  const result = isSubscriptionActive({
    status: "active",
    currentPeriodEnd: createDate(-1),
  });
  console.assert(result === false, "Expired subscription should return false");
  console.log("9. Expired subscription: PASS");
}

// Test 10: Canceled subscription
{
  const result = isSubscriptionActive({
    status: "canceled",
    currentPeriodEnd: createDate(10),
  });
  console.assert(result === false, "Canceled subscription should return false");
  console.log("10. Canceled subscription: PASS");
}

// Test 11: No subscription
{
  const result = isSubscriptionActive(null);
  console.assert(result === false, "No subscription should return false");
  console.log("11. No subscription: PASS");
}

// Test computeTrialEndDate
console.log("\n=== Testing computeTrialEndDate ===\n");

// Test 12: Trial end date calculation
{
  const createdAt = new Date("2025-01-01T00:00:00Z");
  const trialEndsAt = computeTrialEndDate(createdAt);
  const expected = new Date("2025-01-15T00:00:00Z");
  console.assert(
    trialEndsAt.getTime() === expected.getTime(),
    `Trial should end 14 days after creation: got ${trialEndsAt.toISOString()}`,
  );
  console.log("12. Trial end date calculation: PASS");
}

// Test getActivationCounterText
console.log("\n=== Testing getActivationCounterText ===\n");

// Test 13: Counter hidden when < 4
{
  console.assert(
    getActivationCounterText(0) === null,
    "Counter null when 0 paid",
  );
  console.assert(
    getActivationCounterText(1) === null,
    "Counter null when 1 paid",
  );
  console.assert(
    getActivationCounterText(2) === null,
    "Counter null when 2 paid",
  );
  console.assert(
    getActivationCounterText(3) === null,
    "Counter null when 3 paid",
  );
  console.log("13. Counter hidden when < 4: PASS");
}

// Test 14: Counter shown when >= 4
{
  console.assert(
    getActivationCounterText(4) === "Activation: 4/6",
    "Counter shown at 4",
  );
  console.assert(
    getActivationCounterText(5) === "Activation: 5/6",
    "Counter shown at 5",
  );
  console.assert(
    getActivationCounterText(6) === "Activation: 6/6",
    "Counter shown at 6",
  );
  console.log("14. Counter shown when >= 4: PASS");
}

console.log("\n=== All tests passed! ===");
