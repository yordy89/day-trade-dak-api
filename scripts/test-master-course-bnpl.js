const Stripe = require('stripe');
require('dotenv').config();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2025-01-27.acacia',
});

async function testMasterCourseBNPL() {
  try {
    console.log('Testing Master Course checkout with BNPL methods...\n');
    
    // Create a checkout session for Master Course with BNPL
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card', 'klarna', 'afterpay_clearpay', 'affirm'],
      mode: 'payment',
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: 'Master Trading Course',
            description: 'Intensive 3-day trading course with live practice and mentorship',
          },
          unit_amount: 299999, // $2,999.99
        },
        quantity: 1,
      }],
      success_url: 'https://example.com/master-course/success',
      cancel_url: 'https://example.com/master-course',
      metadata: {
        eventType: 'master_course',
        eventId: 'master-course-default',
      }
    });
    
    console.log('✅ Master Course checkout session created successfully!');
    console.log('Session ID:', session.id);
    console.log('Checkout URL:', session.url);
    console.log('\nPayment method types available:', session.payment_method_types);
    console.log('\nBNPL availability for $2,999.99:');
    console.log('- Klarna: ✅ Available ($1 - $10,000)');
    console.log('- Afterpay: ❌ Not available (max $2,000)');
    console.log('- Affirm: ✅ Available ($50 - $30,000)');
    
    console.log('\n🔗 Test the checkout here:');
    console.log(session.url);
    
  } catch (error) {
    console.error('❌ Error creating checkout session:', error.message);
    if (error.raw) {
      console.error('Stripe error details:', error.raw);
    }
  }
}

console.log('Master Course BNPL Test');
console.log('=======================');
console.log('Price: $2,999.99');
console.log('Expected BNPL: Klarna ✅, Affirm ✅, Afterpay ❌');
console.log('');

testMasterCourseBNPL();