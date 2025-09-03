// Script to test subscription renewal by forcing immediate billing
// Usage: node test-subscription-renewal.js sub_XXXXX

const Stripe = require('stripe');
require('dotenv').config();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

async function testSubscriptionRenewal(subscriptionId) {
  try {
    console.log('🔄 Testing subscription renewal for:', subscriptionId);
    
    // 1. Get the subscription
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    console.log('📋 Current subscription status:', subscription.status);
    console.log('📅 Current period end:', new Date(subscription.current_period_end * 1000));
    
    // 2. Create an invoice for the subscription (forces immediate billing)
    console.log('\n💳 Creating invoice for immediate payment...');
    const invoice = await stripe.invoices.create({
      customer: subscription.customer,
      subscription: subscriptionId,
      auto_advance: true, // Automatically finalize and attempt payment
      description: 'Test renewal - payment retry'
    });
    
    console.log('✅ Invoice created:', invoice.id);
    console.log('💰 Amount:', invoice.amount_due / 100, invoice.currency.toUpperCase());
    
    // 3. Pay the invoice (simulates successful payment)
    if (invoice.status === 'open') {
      console.log('\n💳 Paying invoice...');
      const paidInvoice = await stripe.invoices.pay(invoice.id);
      console.log('✅ Payment successful!');
      console.log('📧 This triggered webhooks:');
      console.log('  - invoice.payment_succeeded');
      console.log('  - customer.subscription.updated');
    }
    
    // 4. Check updated subscription
    const updatedSubscription = await stripe.subscriptions.retrieve(subscriptionId);
    console.log('\n📊 Updated subscription:');
    console.log('📅 New period end:', new Date(updatedSubscription.current_period_end * 1000));
    
    console.log('\n✨ Test complete! Check your database for updated dates.');
    console.log('🔍 Look for logs containing:', subscriptionId);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.type === 'StripeInvalidRequestError') {
      console.log('\n💡 Tip: Make sure the subscription ID is correct and active');
    }
  }
}

// Run the test
const subscriptionId = process.argv[2];
if (!subscriptionId) {
  console.log('Usage: node test-subscription-renewal.js sub_XXXXX');
  console.log('\nExample: node test-subscription-renewal.js sub_1OQxyz...');
  process.exit(1);
}

testSubscriptionRenewal(subscriptionId);