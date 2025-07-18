# Payment Success Flow Documentation

## Overview
After a successful Stripe payment, users are redirected to a success page that confirms their payment and activates their subscription.

## Current Implementation

### 1. Success URL Configuration
- **Development**: `http://localhost:4000/api/payments/success?session_id={SESSION_ID}&plan={PLAN}`
- **Production**: `https://api.daytraddak.com/api/payments/success?session_id={SESSION_ID}&plan={PLAN}`

### 2. Success Page Flow
1. User completes payment on Stripe
2. Stripe redirects to `/api/payments/success` with session ID
3. Backend serves an HTML page that:
   - Shows success message
   - Calls `/api/payments/confirm-payment` to verify payment
   - Redirects to frontend dashboard after 2 seconds

### 3. Available Endpoints

#### GET /api/payments/success
Serves the payment success HTML page.

Query Parameters:
- `session_id`: Stripe checkout session ID
- `plan`: Subscription plan name

#### POST /api/payments/confirm-payment
Confirms payment and returns subscription status.

Request Body:
```json
{
  "sessionId": "cs_test_..."
}
```

Response:
```json
{
  "success": true,
  "message": "Payment successful! Your subscription is now active.",
  "subscription": {
    "plan": "Basic",
    "status": "active"
  },
  "user": {
    "id": "userId",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe"
  },
  "redirectUrl": "/dashboard"
}
```

#### GET /api/payments/checkout-session/:sessionId
Get detailed checkout session information.

Response:
```json
{
  "id": "cs_test_...",
  "status": "complete",
  "paymentStatus": "paid",
  "customerEmail": "user@example.com",
  "amountTotal": 14.99,
  "currency": "usd",
  "metadata": {
    "userId": "123",
    "plan": "Basic"
  },
  "subscription": "sub_...",
  "mode": "subscription",
  "user": {
    "id": "userId",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe"
  }
}
```

## Frontend Integration

### Option 1: Handle in Dashboard Component
```javascript
// In your dashboard component
useEffect(() => {
  const urlParams = new URLSearchParams(window.location.search);
  const paymentStatus = urlParams.get('payment');
  const sessionId = urlParams.get('session_id');
  
  if (paymentStatus === 'success' && sessionId) {
    confirmPayment(sessionId);
  }
}, []);

const confirmPayment = async (sessionId) => {
  try {
    const response = await fetch('/api/payments/confirm-payment', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ sessionId }),
    });
    
    const data = await response.json();
    
    if (data.success) {
      toast.success(data.message);
      // Update user context with new subscription
      updateUserSubscription(data.subscription);
      // Clean URL
      window.history.replaceState({}, document.title, '/dashboard');
    }
  } catch (error) {
    console.error('Error confirming payment:', error);
  }
};
```

### Option 2: Create Dedicated Success Page
Create a route `/payment/success` in your frontend that handles the payment confirmation.

## Environment Variables

Add to your `.env` file:
```
BACKEND_URL=http://localhost:4000  # Development
# BACKEND_URL=https://api.daytraddak.com  # Production
```

## Webhook Events

The system also processes these webhook events:
- `checkout.session.completed` - Initial payment completion
- `invoice.payment_succeeded` - Recurring payments
- `customer.subscription.deleted` - Cancellations
- `invoice.payment_failed` - Failed payments

## Testing

1. Create a test checkout session:
```bash
curl -X POST http://localhost:4000/api/payments/checkout \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "USER_ID",
    "priceId": "price_..."
  }'
```

2. Complete payment in Stripe test mode
3. Verify redirect to success page
4. Check user subscription is activated

## Troubleshooting

### 404 Error After Payment
- Ensure `BACKEND_URL` is set correctly in `.env`
- Check that the success HTML file is copied to dist folder
- Verify the API is running on the correct port

### Payment Not Activating Subscription
- Check webhook endpoint is configured in Stripe dashboard
- Verify webhook secret is correct
- Check logs for webhook processing errors

### User Not Found After Payment
- Ensure userId is passed correctly in checkout metadata
- Check that user exists in database before payment
- Verify Stripe customer ID is saved to user record