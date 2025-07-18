# Payment Flow Testing Guide

## Setup
1. Ensure API is running on port 4000
2. Ensure CRM is running on port 3000 (or 3001)
3. Update `.env` if CRM is on different port:
   ```
   FRONTEND_URL=http://localhost:3001
   ```

## Test Steps

### 1. Create Test Checkout Session
```bash
curl -X POST http://localhost:4000/api/payments/checkout \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "userId": "USER_ID",
    "priceId": "price_1Qy0JcJ1acFkbhNI4q0axjLX"
  }'
```

### 2. Test Enhanced Checkout (Recommended)
```bash
curl -X POST http://localhost:4000/api/payments/checkout/enhanced \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "plan": "Basic"
  }'
```

### 3. Complete Payment in Stripe
- Use test card: 4242 4242 4242 4242
- Any future expiry date
- Any CVC
- Any ZIP

### 4. Verify Redirect Flow
1. After payment, you should be redirected to:
   `http://localhost:3001/payment/success?session_id=cs_test_...&plan=Basic`

2. This page will:
   - Confirm the payment with the API
   - Update user profile
   - Redirect to `/academy/subscription/success`

3. The subscription success page will:
   - Show payment confirmation
   - Display the activated plan
   - Provide navigation to the course

## Webhook Testing

### Local Webhook Testing with Stripe CLI
```bash
# Install Stripe CLI if not already installed
brew install stripe/stripe-cli/stripe

# Login to Stripe
stripe login

# Forward webhooks to local API
stripe listen --forward-to localhost:4000/api/payments/webhook

# In another terminal, trigger test events
stripe trigger payment_intent.succeeded
```

## Common Issues

### 404 on Payment Success
- Check `FRONTEND_URL` in API `.env` matches CRM port
- Ensure `/payment/success` route exists in CRM

### Subscription Not Activating
- Check webhook is properly configured
- Verify webhook secret matches
- Check API logs for webhook errors

### User Not Found
- Ensure user is logged in before checkout
- Check JWT token is valid
- Verify userId is passed in checkout

## API Endpoints for Testing

### Get Checkout Session Details
```bash
curl http://localhost:4000/api/payments/checkout-session/SESSION_ID
```

### Confirm Payment
```bash
curl -X POST http://localhost:4000/api/payments/confirm-payment \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "cs_test_..."
  }'
```

### Check User Subscriptions
```bash
curl http://localhost:4000/api/payments/subscriptions \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```