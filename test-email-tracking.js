const axios = require('axios');

async function testEmailTracking() {
  const campaignId = '68c1cb0b2c3d9f6c435ab1f8';
  const email = 'yordyat1107@gmail.com';
  const apiUrl = 'http://localhost:4000/api/v1';
  
  console.log('Testing Email Tracking for Campaign:', campaignId);
  console.log('Email:', email);
  console.log('-----------------------------------\n');
  
  // Test 1: Open tracking
  console.log('1. Testing OPEN tracking...');
  const openUrl = `${apiUrl}/email-marketing/tracking/open/${campaignId}/${encodeURIComponent(email)}.png`;
  console.log('   URL:', openUrl);
  
  try {
    const response = await axios.get(openUrl, { 
      responseType: 'arraybuffer',
      headers: { 'User-Agent': 'Email Client' }
    });
    console.log('   ✅ Open tracking successful:', response.status);
    console.log('   Image size:', response.data.length, 'bytes');
  } catch (error) {
    console.log('   ❌ Open tracking failed:', error.message);
  }
  
  // Wait a bit
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Test 2: Click tracking
  console.log('\n2. Testing CLICK tracking...');
  const targetUrl = 'https://daytradedak.com/live';
  const clickUrl = `${apiUrl}/email-marketing/tracking/click/${campaignId}/${encodeURIComponent(email)}?url=${encodeURIComponent(targetUrl)}&linkId=test123`;
  console.log('   URL:', clickUrl);
  
  try {
    const response = await axios.get(clickUrl, { 
      maxRedirects: 0,
      validateStatus: (status) => status === 301 || status === 302
    });
    console.log('   ✅ Click tracking successful:', response.status);
    console.log('   Redirects to:', response.headers.location);
  } catch (error) {
    if (error.response && (error.response.status === 301 || error.response.status === 302)) {
      console.log('   ✅ Click tracking successful:', error.response.status);
      console.log('   Redirects to:', error.response.headers.location);
    } else {
      console.log('   ❌ Click tracking failed:', error.message);
    }
  }
  
  // Wait and check analytics
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Test 3: Check campaign analytics
  console.log('\n3. Checking campaign analytics...');
  try {
    const response = await axios.get(`${apiUrl}/email-marketing/analytics/campaign/${campaignId}`, {
      headers: {
        'Authorization': 'Bearer YOUR_JWT_TOKEN' // You'll need to add a valid token
      }
    });
    console.log('   Analytics Summary:');
    console.log('   - Sent:', response.data.summary.sent);
    console.log('   - Delivered:', response.data.summary.delivered);
    console.log('   - Opened:', response.data.summary.opened);
    console.log('   - Clicked:', response.data.summary.clicked);
    console.log('   - Open Rate:', response.data.openRate.toFixed(2) + '%');
    console.log('   - Click Rate:', response.data.clickRate.toFixed(2) + '%');
  } catch (error) {
    console.log('   ⚠️  Could not fetch analytics (need auth token)');
  }
  
  console.log('\n-----------------------------------');
  console.log('Check the API logs for detailed tracking information.');
  console.log('Look for messages like:');
  console.log('- "Tracking open - Campaign: ..."');
  console.log('- "Email opened - Campaign: ..."');
  console.log('- "Analytics updated: ..."');
  console.log('- "Campaign analytics updated - Opened count: ..."');
}

testEmailTracking().catch(console.error);