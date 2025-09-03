# Testing Recurring Subscriptions with Stripe

## Method 1: Stripe Test Clock (Recommended)

1. **Create a Test Clock in Stripe Dashboard:**
   ```bash
   # Or use Stripe CLI
   stripe test_clocks create \
     --name "Weekly Subscription Test" \
     --frozen-time $(date +%s)
   ```

2. **Create a customer attached to the test clock:**
   ```bash
   stripe customers create \
     --test-clock TEST_CLOCK_ID \
     --email "test@example.com"
   ```

3. **Create subscription with the test customer:**
   - Use your normal checkout flow
   - The subscription will be attached to the test clock

4. **Advance time to trigger renewal:**
   ```bash
   # Advance 7 days for weekly subscription
   stripe test_clocks advance \
     TEST_CLOCK_ID \
     --frozen-time $(date -d "+7 days" +%s)
   ```

5. **This will trigger:**
   - `invoice.payment_succeeded` webhook
   - `customer.subscription.updated` webhook
   - Your handleRecurringPayment function

## Method 2: Stripe CLI Webhook Trigger

1. **Install Stripe CLI:**
   ```bash
   brew install stripe/stripe-cli/stripe
   ```

2. **Login and forward webhooks:**
   ```bash
   stripe login
   stripe listen --forward-to localhost:3001/api/v1/payments/stripe/webhook
   ```

3. **Trigger specific webhook events:**
   ```bash
   # Trigger invoice.payment_succeeded (recurring payment)
   stripe trigger invoice.payment_succeeded \
     --add invoice:subscription=sub_TEST_ID \
     --add invoice:customer=cus_TEST_ID
   
   # Trigger subscription update
   stripe trigger customer.subscription.updated
   ```

## Method 3: Manual Testing with Test Cards

1. **Create a weekly subscription with test card:**
   - Card: `4242 4242 4242 4242`
   - Any future expiry and CVC

2. **Use Stripe Dashboard to simulate:**
   - Go to the subscription in Stripe Dashboard
   - Click "Actions" → "Update subscription"
   - Change the billing anchor to today
   - This triggers immediate billing

## Method 4: Direct Webhook Testing

Create a test script to send webhook directly:

```javascript
// test-webhook.js
const axios = require('axios');
const crypto = require('crypto');

// Your webhook endpoint secret
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

// Create a fake invoice.payment_succeeded event
const event = {
  id: 'evt_test_' + Date.now(),
  type: 'invoice.payment_succeeded',
  created: Math.floor(Date.now() / 1000),
  data: {
    object: {
      id: 'in_test_' + Date.now(),
      customer: 'cus_TEST', // Use real customer ID
      subscription: 'sub_TEST', // Use real subscription ID
      amount_paid: 1499, // $14.99 in cents
      currency: 'usd',
      payment_intent: 'pi_test_' + Date.now(),
      lines: {
        data: [{
          period: {
            end: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60), // 7 days from now
          }
        }]
      },
      subscription_details: {
        metadata: {
          plan: 'LiveWeeklyRecurring',
          billingCycle: 'WEEKLY'
        }
      }
    }
  }
};

// Generate signature
const payload = JSON.stringify(event);
const signature = crypto
  .createHmac('sha256', webhookSecret)
  .update(payload)
  .digest('hex');

// Send to your webhook endpoint
axios.post('http://localhost:3001/api/v1/payments/stripe/webhook', 
  payload,
  {
    headers: {
      'stripe-signature': `t=${Math.floor(Date.now() / 1000)},v1=${signature}`,
      'content-type': 'application/json'
    }
  }
).then(response => {
  console.log('Webhook sent successfully:', response.data);
}).catch(error => {
  console.error('Error:', error.response?.data);
});
```

## Method 5: Database Manipulation + Webhook

1. **Find a user with LiveWeeklyRecurring subscription:**
   ```javascript
   // In MongoDB
   db.users.findOne({
     "subscriptions.plan": "LiveWeeklyRecurring"
   })
   ```

2. **Note their `stripeCustomerId` and `stripeSubscriptionId`**

3. **Manually update their `currentPeriodEnd` to expired:**
   ```javascript
   db.users.updateOne(
     { _id: ObjectId("USER_ID") },
     { 
       $set: { 
         "subscriptions.$[elem].currentPeriodEnd": new Date("2024-01-01")
       }
     },
     { 
       arrayFilters: [{ "elem.plan": "LiveWeeklyRecurring" }]
     }
   )
   ```

4. **Use Stripe CLI to trigger renewal:**
   ```bash
   stripe trigger invoice.payment_succeeded
   ```

## Verification Steps

After triggering any test, verify:

1. **Check MongoDB for updated dates:**
   ```javascript
   db.users.findOne(
     { _id: ObjectId("USER_ID") },
     { subscriptions: 1 }
   )
   ```
   - Verify `currentPeriodEnd` is 7 days in future
   - Verify `expiresAt` matches `currentPeriodEnd`
   - Verify `status` is "active"

2. **Check API logs:**
   ```bash
   # Look for these log messages
   grep "Updating subscription" /path/to/logs
   grep "Recurring payment recorded" /path/to/logs
   ```

3. **Test user access:**
   ```bash
   # Check if user still has access
   curl -H "Authorization: Bearer USER_TOKEN" \
     http://localhost:3001/api/v1/admin/module-permissions/my-access/liveRecorded
   ```

4. **Check transactions table:**
   ```javascript
   db.transactions.find({
     userId: "USER_ID",
     type: "RECURRING"
   }).sort({ createdAt: -1 }).limit(1)
   ```

## Quick Test Checklist

- [ ] Subscription has `stripeSubscriptionId` field
- [ ] After payment: `currentPeriodEnd` updated to +7 days
- [ ] After payment: `expiresAt` matches `currentPeriodEnd`  
- [ ] Transaction record created with type "RECURRING"
- [ ] User maintains access to LiveRecorded content
- [ ] Logs show "Updating subscription" message

## Common Issues to Watch For

1. **No update happens:**
   - Check if `stripeSubscriptionId` exists in user record
   - Verify webhook is being received (check logs)
   - Check for exact plan name match

2. **Access lost after payment:**
   - Check both `currentPeriodEnd` and `expiresAt` fields
   - Verify subscription `status` is "active"
   - Check module permission service logs

3. **Duplicate subscriptions created:**
   - Check if matching by `stripeSubscriptionId` is working
   - Look for multiple entries with same plan