const axios = require('axios');

async function testMasterCourseCheckout() {
  try {
    console.log('Testing Master Course checkout...\n');
    
    const response = await axios.post('http://localhost:4000/api/v1/payments/event-checkout', {
      eventId: 'master-course-default',
      firstName: 'Test',
      lastName: 'User',
      email: 'test@example.com',
      phoneNumber: '+15555551234'
    });
    
    console.log('✅ Checkout session created successfully!');
    console.log('Session ID:', response.data.sessionId);
    console.log('\n🔗 Open this URL in your browser to see the checkout page:');
    console.log(response.data.url);
    console.log('\n📋 Payment methods should include:');
    console.log('- Card');
    console.log('- Klarna (Buy Now Pay Later)');
    console.log('- Affirm (Buy Now Pay Later)');
    console.log('\n⚠️  Note: Afterpay is NOT available for $2,999.99 (exceeds $2,000 limit)');
    
  } catch (error) {
    console.error('❌ Error creating checkout session:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    } else {
      console.error(error.message);
    }
  }
}

console.log('Master Course BNPL Checkout Test');
console.log('================================');
console.log('Price: $2,999.99');
console.log('Expected BNPL: Klarna ✅, Affirm ✅, Afterpay ❌');
console.log('');

testMasterCourseCheckout();