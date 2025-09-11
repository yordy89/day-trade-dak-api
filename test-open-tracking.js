// Test open tracking with API
const axios = require('axios');
const mongoose = require('mongoose');
require('dotenv').config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/daytradedak';
const API_URL = 'http://localhost:4000/api/v1';

async function testOpenTracking() {
  try {
    await mongoose.connect(MONGO_URI);
    const db = mongoose.connection.db;
    
    // Get the latest campaign
    const campaign = await db.collection('campaigns').findOne({
      status: 'sent'
    }, { sort: { _id: -1 } });
    
    if (!campaign) {
      console.log('No sent campaigns found');
      return;
    }
    
    console.log(`📧 Testing campaign: ${campaign.name} (${campaign._id})`);
    const testEmail = campaign.recipientEmails?.[0] || 'yordyat1107@gmail.com';
    
    // Check current status
    console.log('\n📊 Before tracking:');
    console.log(`Campaign analytics: ${JSON.stringify(campaign.analytics)}`);
    
    const recipient = campaign.recipients?.find(r => r.email === testEmail);
    console.log(`Recipient (${testEmail}):`, {
      opened: recipient?.opened,
      openCount: recipient?.openCount,
      delivered: recipient?.delivered
    });
    
    // Trigger open tracking
    console.log('\n🎯 Triggering open tracking...');
    const openUrl = `${API_URL}/email-marketing/tracking/open/${campaign._id}/${encodeURIComponent(testEmail)}.png`;
    console.log(`URL: ${openUrl}`);
    
    try {
      const response = await axios.get(openUrl, {
        responseType: 'arraybuffer',
        headers: { 'User-Agent': 'Email Client' }
      });
      console.log(`✅ Open tracking response: ${response.status}`);
    } catch (error) {
      console.log(`❌ Open tracking error: ${error.message}`);
    }
    
    // Wait for database update
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Check updated status
    const updatedCampaign = await db.collection('campaigns').findOne({ _id: campaign._id });
    console.log('\n📊 After tracking:');
    console.log(`Campaign analytics: ${JSON.stringify(updatedCampaign.analytics)}`);
    
    const updatedRecipient = updatedCampaign.recipients?.find(r => r.email === testEmail);
    console.log(`Recipient (${testEmail}):`, {
      opened: updatedRecipient?.opened,
      openCount: updatedRecipient?.openCount,
      delivered: updatedRecipient?.delivered
    });
    
    // Check analytics collection
    const analyticsRecord = await db.collection('campaignanalytics').findOne({
      campaignId: campaign._id.toString(),
      recipientEmail: testEmail
    });
    
    console.log('\n🗄️ Analytics collection record:');
    console.log({
      opened: analyticsRecord?.opened,
      openCount: analyticsRecord?.openCount,
      delivered: analyticsRecord?.delivered
    });
    
    // Calculate rates
    const openRate = updatedCampaign.analytics.delivered > 0 
      ? (updatedCampaign.analytics.opened / updatedCampaign.analytics.delivered * 100).toFixed(2)
      : 0;
    
    console.log(`\n📈 Open Rate: ${openRate}%`);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n✅ Test completed');
  }
}

testOpenTracking();