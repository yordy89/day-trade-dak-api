# Buy Now Pay Later (BNPL) Setup Guide

## Overview
We've integrated Klarna, Affirm, and Afterpay/Clearpay into the payment system. However, these payment methods need to be enabled in your Stripe Dashboard first.

## Master Course BNPL Availability
For the Master Course at $2,999.99:
- ✅ **Klarna** - Available ($1 - $10,000 range)
- ✅ **Affirm** - Available ($50 - $30,000 range)  
- ✅ **Afterpay/Clearpay** - Available ($1 - $4,000 range based on account limits)

## Setup Steps

### 1. Enable BNPL in Stripe Dashboard

1. Log in to your [Stripe Dashboard](https://dashboard.stripe.com)
2. Switch to **Test Mode** (toggle in the top-right)
3. Go to **Settings** → **Payment methods**
4. Find and enable:
   - **Klarna**
   - **Afterpay/Clearpay**
   - **Affirm**

### 2. Configure Each Payment Method

#### Klarna Setup
1. Click on **Klarna** in payment methods
2. Click **Turn on** or **Configure**
3. Fill in required business information:
   - Business category
   - Customer service email
   - Customer service phone
4. Save settings

#### Affirm Setup
1. Click on **Affirm** in payment methods
2. Click **Turn on** or **Configure**
3. Complete the onboarding:
   - Business information
   - Website URL
   - Product categories
4. Save settings

#### Afterpay/Clearpay Setup
1. Click on **Afterpay/Clearpay** in payment methods
2. Click **Turn on** or **Configure**
3. Provide:
   - Business details
   - Website information
   - Return policy URL
4. Save settings

### 3. Test Mode Configuration

In test mode, you might need to:
1. Use test customer addresses from supported countries:
   - **US address** for Affirm
   - **US/UK/AU** address for Afterpay
   - **US/EU** address for Klarna

2. The BNPL options will only appear if:
   - Payment method is enabled in Stripe
   - Customer's billing address is in a supported country
   - Amount is within the provider's limits

### 4. Testing BNPL

Use these test cards/details:
- Any valid test card (4242 4242 4242 4242)
- US billing address:
  ```
  Street: 123 Main St
  City: San Francisco
  State: CA
  ZIP: 94102
  Country: United States
  ```

### 5. Verify Implementation

1. Check server logs when creating a checkout:
   ```
   Creating event checkout for Master Trading Course
   Event price: $2999.99 USD
   Payment methods: card, klarna, affirm
   ```

2. The API correctly filters payment methods based on amount:
   - Master Course ($2,999.99): card, klarna, affirm
   - Small amounts (<$50): card, klarna, afterpay_clearpay
   - Subscriptions: card only

## Troubleshooting

### BNPL not showing in checkout?

1. **Check Stripe Dashboard**
   - Ensure payment methods are enabled
   - Check for any pending onboarding steps

2. **Check Customer Location**
   - BNPL availability depends on customer's country
   - Use a US address for testing all methods

3. **Check Environment Variables**
   - Ensure `STRIPE_BNPL_ENABLED=true` (or not set)
   - Restart the API server after changes

4. **Check Browser Console**
   - Look for any Stripe.js errors
   - Clear browser cache and cookies

### Still not working?

1. Visit the test checkout URL to verify Stripe configuration:
   ```
   curl -X POST http://localhost:4000/api/v1/payments/event-checkout \
     -H "Content-Type: application/json" \
     -d '{
       "eventId": "master-course-default",
       "firstName": "Test",
       "lastName": "User",
       "email": "test@example.com"
     }'
   ```

2. Check the returned checkout URL in a browser

## Production Considerations

1. **Onboarding**: Each BNPL provider requires full business verification
2. **Fees**: BNPL methods have higher transaction fees than cards
3. **Settlement**: Payment timing varies by provider
4. **Disputes**: Different dispute processes for each provider

## Code Implementation

The BNPL logic is implemented in:
- `/src/payments/stripe/stripe.service.ts` - `getBNPLMethods()` function
- Automatically filters based on:
  - Payment amount
  - Currency
  - Payment type (one-time vs subscription)

No code changes needed - just enable in Stripe Dashboard!