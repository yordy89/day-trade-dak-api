/**
 * Payment Success Handler
 *
 * This module provides instructions for handling successful payments in the frontend.
 * After a successful Stripe payment, users are redirected to:
 *
 * Development: http://localhost:3000/dashboard?payment=success&session_id={SESSION_ID}&plan={PLAN}
 * Production: https://yourdomain.com/dashboard?payment=success&session_id={SESSION_ID}&plan={PLAN}
 *
 * Frontend Implementation Guide:
 *
 * 1. In your dashboard component, check for payment success query parameters:
 *
 * ```javascript
 * useEffect(() => {
 *   const urlParams = new URLSearchParams(window.location.search);
 *   const paymentStatus = urlParams.get('payment');
 *   const sessionId = urlParams.get('session_id');
 *   const plan = urlParams.get('plan');
 *
 *   if (paymentStatus === 'success' && sessionId) {
 *     // Call the API to confirm payment
 *     confirmPayment(sessionId);
 *   }
 * }, []);
 *
 * const confirmPayment = async (sessionId) => {
 *   try {
 *     const response = await fetch('/api/payments/confirm-payment', {
 *       method: 'POST',
 *       headers: {
 *         'Content-Type': 'application/json',
 *       },
 *       body: JSON.stringify({ sessionId }),
 *     });
 *
 *     const data = await response.json();
 *
 *     if (data.success) {
 *       // Show success message
 *       toast.success(data.message);
 *
 *       // Update user context/state with new subscription
 *       updateUserSubscription(data.subscription);
 *
 *       // Clean URL
 *       window.history.replaceState({}, document.title, '/dashboard');
 *     } else {
 *       // Show processing message
 *       toast.info(data.message);
 *     }
 *   } catch (error) {
 *     console.error('Error confirming payment:', error);
 *     toast.error('Error confirming payment. Please refresh the page.');
 *   }
 * };
 * ```
 *
 * 2. Alternative: Direct checkout session query
 *
 * ```javascript
 * const getCheckoutSession = async (sessionId) => {
 *   try {
 *     const response = await fetch(`/api/payments/checkout-session/${sessionId}`);
 *     const session = await response.json();
 *
 *     if (session.paymentStatus === 'paid') {
 *       // Payment successful
 *       toast.success(`Welcome to ${session.metadata.plan} plan!`);
 *     }
 *   } catch (error) {
 *     console.error('Error fetching session:', error);
 *   }
 * };
 * ```
 *
 * 3. For production, update FRONTEND_URL in .env:
 *    FRONTEND_URL=https://app.daytraddak.com
 *
 * 4. Available API endpoints:
 *    - GET  /api/payments/checkout-session/:sessionId - Get session details
 *    - POST /api/payments/confirm-payment - Confirm payment with sessionId
 *    - GET  /api/payments/subscriptions - Get user's active subscriptions
 *    - GET  /api/payments/history - Get payment history
 */

export const PAYMENT_SUCCESS_ROUTES = {
  development: 'http://localhost:3000/dashboard',
  production: 'https://app.daytraddak.com/dashboard',
};

export const PAYMENT_QUERY_PARAMS = {
  status: 'payment=success',
  sessionId: 'session_id={CHECKOUT_SESSION_ID}',
  plan: 'plan={PLAN}',
};
