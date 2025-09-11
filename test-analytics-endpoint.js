const axios = require('axios');

async function testAnalyticsEndpoint() {
  const campaignId = '68c1cd9adc8d20cc6d01c81c';
  const apiUrl = 'http://localhost:4000/api/v1';
  
  console.log('Testing analytics endpoint for campaign:', campaignId);
  console.log('-----------------------------------\n');
  
  try {
    // Note: You may need to add an authorization token here
    const response = await axios.get(`${apiUrl}/email-marketing/analytics/campaigns/${campaignId}`);
    
    console.log('Response status:', response.status);
    console.log('\nSummary:');
    console.log(JSON.stringify(response.data.summary, null, 2));
    
    console.log('\nRates:');
    console.log('- Open Rate:', response.data.openRate?.toFixed(2) + '%');
    console.log('- Click Rate:', response.data.clickRate?.toFixed(2) + '%');
    console.log('- Delivery Rate:', response.data.deliveryRate?.toFixed(2) + '%');
    
    console.log('\nRecipients (' + response.data.recipients?.length + ' total):');
    if (response.data.recipients && response.data.recipients.length > 0) {
      response.data.recipients.forEach((r, i) => {
        console.log(`\n${i + 1}. ${r.recipientEmail || 'Unknown email'}`);
        console.log('   - Sent:', r.sent);
        console.log('   - Delivered:', r.delivered);
        console.log('   - Opened:', r.opened, r.openCount ? `(${r.openCount} times)` : '');
        console.log('   - Clicked:', r.clicked, r.clickCount ? `(${r.clickCount} times)` : '');
        console.log('   - Bounced:', r.bounced);
        console.log('   - Unsubscribed:', r.unsubscribed);
      });
    } else {
      console.log('No recipients data returned');
    }
    
  } catch (error) {
    console.error('Error:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
  }
}

testAnalyticsEndpoint();