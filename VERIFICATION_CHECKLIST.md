# Payment System Verification Checklist

## Prerequisites
1. Set up Stripe account (test mode)
2. Create a monthly subscription product and price
3. Configure environment variables:
   ```
   STRIPE_SECRET_KEY=sk_test_...
   STRIPE_WEBHOOK_SECRET=whsec_...
   STRIPE_PRICE_ID=price_...
   ```
4. Set up Stripe webhook endpoint: `https://your-domain/api/webhooks/stripe`
   - Events to listen: `checkout.session.completed`, `customer.subscription.created`, 
     `customer.subscription.updated`, `customer.subscription.deleted`,
     `invoice.payment_succeeded`, `invoice.payment_failed`

---

## Manual Verification Tests

### 1. New Cohort Creation - TRIAL Status
- [ ] Create a new cohort
- [ ] Verify `status` is "TRIAL"
- [ ] Verify `trialEndsAt` is set to 14 days from creation
- [ ] Verify creator has role "OWNER"

### 2. Trial Mode - Submissions Allowed
- [ ] During trial, user can create submissions
- [ ] Submission is saved to database
- [ ] Streak calculation works correctly

### 3. Stripe Checkout Session
- [ ] Navigate to /billing page
- [ ] Click "Activate Membership" button
- [ ] Verify redirect to Stripe Checkout
- [ ] Complete test payment (use card 4242 4242 4242 4242)
- [ ] Verify redirect back to /billing?success=true

### 4. Webhook - Subscription Created
- [ ] After checkout, webhook fires `customer.subscription.created`
- [ ] Subscription record created in database
- [ ] User's subscription status is "active"
- [ ] `currentPeriodEnd` is set correctly

### 5. Cohort Activation (6 Paid Members)
- [ ] Create 6 test users in the same cohort
- [ ] Each user completes Stripe checkout
- [ ] After 6th subscription, cohort status becomes "ACTIVE"
- [ ] `activatedAt` timestamp is set
- [ ] Activation counter shows "Activation: 6/6" (when >= 4)

### 6. Activation Counter Visibility
- [ ] With 0-3 paid members: counter is hidden
- [ ] With 4-5 paid members: counter shows "Activation: X/6"
- [ ] Text: "Unlocks when 6 members activate."

### 7. Trial Expiration - LOCKED Status
- [ ] Set cohort's `trialEndsAt` to a past date (manual DB edit for testing)
- [ ] With < 6 paid members, cohort becomes "LOCKED"
- [ ] User sees "Submissions Paused" message on /submit
- [ ] User cannot create new submissions (API returns 403)
- [ ] User can still view /me (history) and /leaderboard

### 8. LOCKED Cohort - View Only Mode
- [ ] /me page loads and shows history
- [ ] /leaderboard page loads and shows rankings
- [ ] /submit page shows lock message with "Activate Membership" button
- [ ] Clicking button redirects to /billing

### 9. Reactivation from LOCKED
- [ ] With cohort in LOCKED status
- [ ] When 6 members have active subscriptions
- [ ] Cohort status changes to "ACTIVE"
- [ ] Submissions are allowed again

### 10. Graceful Degradation (No Stripe Config)
- [ ] Remove STRIPE_SECRET_KEY from .env
- [ ] /billing page shows "Payment system is not configured"
- [ ] No crash or error on other pages
- [ ] Cohort trial/lock logic still works

---

## Automated Tests

Run automated tests:
```bash
npm run test:cohort-status
```

### Test Coverage
- `computeCohortStatus()` - All status transitions
- `isSubscriptionActive()` - Active/expired/canceled states
- `computeTrialEndDate()` - 14 days calculation
- `getActivationCounterText()` - Visibility threshold (>= 4)

---

## Database Verification Queries

```sql
-- Check cohort status
SELECT id, name, status, trialEndsAt, activatedAt FROM Cohort;

-- Check subscriptions
SELECT s.*, u.email 
FROM Subscription s 
JOIN User u ON s.userId = u.id;

-- Count paid members per cohort
SELECT 
  c.id,
  c.name,
  c.status,
  COUNT(CASE WHEN s.status = 'active' THEN 1 END) as paidCount
FROM Cohort c
LEFT JOIN CohortMember cm ON c.id = cm.cohortId
LEFT JOIN User u ON cm.userId = u.id
LEFT JOIN Subscription s ON u.id = s.userId
GROUP BY c.id;
```

---

## Edge Cases to Test

1. **User in multiple cohorts**: Only active cohort affects their submission ability
2. **Subscription expires mid-month**: User counts as paid until `currentPeriodEnd`
3. **Subscription canceled but not expired**: Still counts as paid until period end
4. **Webhook retry**: Idempotent handling of duplicate events
5. **Network failure during checkout**: User can retry from /billing
