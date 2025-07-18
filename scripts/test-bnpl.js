const Stripe = require('stripe');
require('dotenv').config();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2025-01-27.acacia',
});

async function testBNPLCheckout() {
  try {
    console.log('Creating test checkout session with BNPL methods...\n');
    
    // Create a one-time payment session with BNPL
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card', 'klarna', 'afterpay_clearpay', 'affirm'],
      mode: 'payment',
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: 'Test Product for BNPL',
            description: 'Testing Buy Now Pay Later options',
          },
          unit_amount: 5000, // $50.00
        },
        quantity: 1,
      }],
      success_url: 'https://example.com/success',
      cancel_url: 'https://example.com/cancel',
    });
    
    console.log('✅ Checkout session created successfully!');
    console.log('Session ID:', session.id);
    console.log('Checkout URL:', session.url);
    console.log('\nPayment method types:', session.payment_method_types);
    console.log('\nNote: BNPL options will only appear if:');
    console.log('1. Payment methods are enabled in your Stripe dashboard');
    console.log('2. Customer is in a supported country');
    console.log('3. Amount is within the BNPL provider limits');
    
    // Test with a subscription (should not include BNPL)
    console.log('\n--- Testing with subscription ---');
    const subscriptionSession = await stripe.checkout.sessions.create({
      payment_method_types: ['card', 'klarna', 'afterpay_clearpay', 'affirm'],
      mode: 'subscription',
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: 'Test Subscription',
          },
          unit_amount: 5000,
          recurring: {
            interval: 'month',
          },
        },
        quantity: 1,
      }],
      success_url: 'https://example.com/success',
      cancel_url: 'https://example.com/cancel',
    });
    
    console.log('Subscription session payment methods:', subscriptionSession.payment_method_types);
    console.log('(BNPL methods are automatically filtered out for subscriptions)');
    
  } catch (error) {
    console.error('❌ Error creating checkout session:', error.message);
    if (error.raw) {
      console.error('Stripe error details:', error.raw);
    }
  }
}

// Check if BNPL is configured in environment
const bnplEnabled = process.env.STRIPE_BNPL_ENABLED !== 'false';
console.log('BNPL enabled in environment:', bnplEnabled);
console.log('Stripe mode:', process.env.STRIPE_SECRET_KEY?.startsWith('sk_test_') ? 'TEST' : 'LIVE');
console.log('');

testBNPLCheckout();