const axios = require('axios');

async function testTracking() {
  const apiUrl = 'http://localhost:4000/api/v1';
  const campaignId = 'test-campaign-123';
  const email = 'test@example.com';
  
  console.log('Testing Email Tracking URLs...\n');
  
  // Test open tracking
  const openUrl = `${apiUrl}/email-marketing/tracking/open/${campaignId}/${encodeURIComponent(email)}.png`;
  console.log('Open Tracking URL:', openUrl);
  
  try {
    const response = await axios.get(openUrl, { 
      responseType: 'arraybuffer',
      headers: { 'User-Agent': 'Email Client' }
    });
    console.log('✅ Open tracking endpoint works:', response.status);
  } catch (error) {
    console.log('❌ Open tracking failed:', error.message);
  }
  
  // Test click tracking
  const targetUrl = 'https://daytradedak.com/live';
  const clickUrl = `${apiUrl}/email-marketing/tracking/click/${campaignId}/${encodeURIComponent(email)}?url=${encodeURIComponent(targetUrl)}&linkId=test123`;
  console.log('\nClick Tracking URL:', clickUrl);
  
  try {
    const response = await axios.get(clickUrl, { 
      maxRedirects: 0,
      validateStatus: (status) => status === 301 || status === 302
    });
    console.log('✅ Click tracking endpoint works:', response.status);
    console.log('   Redirects to:', response.headers.location);
  } catch (error) {
    if (error.response && error.response.status === 301) {
      console.log('✅ Click tracking endpoint works:', error.response.status);
      console.log('   Redirects to:', error.response.headers.location);
    } else {
      console.log('❌ Click tracking failed:', error.message);
    }
  }
  
  // Show example HTML with tracking
  console.log('\n\nExample HTML with tracking:');
  console.log('----------------------------');
  const sampleHtml = `
<html>
<body>
  <h1>Test Email</h1>
  <p>Click <a href="${clickUrl}">here</a> to join the webinar!</p>
  
  <!-- Tracking pixel -->
  <img src="${openUrl}" width="1" height="1" style="display:block;border:0;" alt="" />
</body>
</html>`;
  console.log(sampleHtml);
}

testTracking().catch(console.error);