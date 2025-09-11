// Test script to verify the new tracking system works
const axios = require('axios');
const mongoose = require('mongoose');
require('dotenv').config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/daytradedak';
const API_URL = 'http://localhost:4000/api/v1';

async function testNewTracking() {
  try {
    // Connect to MongoDB to check data
    await mongoose.connect(MONGO_URI);
    const db = mongoose.connection.db;
    
    // Get a campaign to test
    const campaign = await db.collection('campaigns').findOne({
      recipients: { $exists: true }
    });
    
    if (!campaign) {
      console.log('No campaigns with recipients found');
      return;
    }
    
    console.log(`Testing campaign: ${campaign.name} (${campaign._id})`);
    console.log(`Recipients: ${campaign.recipients?.length || 0}`);
    
    if (campaign.recipients && campaign.recipients.length > 0) {
      const recipient = campaign.recipients[0];
      console.log(`\nTesting with recipient: ${recipient.email}`);
      console.log('Current status:');
      console.log(`  - Sent: ${recipient.sent}`);
      console.log(`  - Delivered: ${recipient.delivered}`);
      console.log(`  - Opened: ${recipient.opened} (count: ${recipient.openCount})`);
      console.log(`  - Clicked: ${recipient.clicked} (count: ${recipient.clickCount})`);
      
      // Test open tracking
      console.log('\n📧 Testing OPEN tracking...');
      const openUrl = `${API_URL}/email-marketing/tracking/open/${campaign._id}/${encodeURIComponent(recipient.email)}.png`;
      
      try {
        await axios.get(openUrl, { responseType: 'arraybuffer' });
        console.log('✅ Open tracking request successful');
        
        // Wait a bit for database update
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Check if it was updated in database
        const updatedCampaign = await db.collection('campaigns').findOne({ _id: campaign._id });
        const updatedRecipient = updatedCampaign.recipients?.find(r => r.email === recipient.email);
        
        console.log('After open tracking:');
        console.log(`  - Opened: ${updatedRecipient?.opened} (count: ${updatedRecipient?.openCount})`);
        console.log(`  - Campaign analytics.opened: ${updatedCampaign?.analytics?.opened}`);
      } catch (error) {
        console.log('❌ Open tracking failed:', error.message);
      }
      
      // Test click tracking
      console.log('\n🔗 Testing CLICK tracking...');
      const clickUrl = `${API_URL}/email-marketing/tracking/click/${campaign._id}/${encodeURIComponent(recipient.email)}?url=https://daytradedak.com&linkId=test`;
      
      try {
        await axios.get(clickUrl, { 
          maxRedirects: 0,
          validateStatus: (status) => status === 301 || status === 302
        });
        console.log('✅ Click tracking request successful');
        
        // Wait a bit for database update
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Check if it was updated in database
        const updatedCampaign2 = await db.collection('campaigns').findOne({ _id: campaign._id });
        const updatedRecipient2 = updatedCampaign2.recipients?.find(r => r.email === recipient.email);
        
        console.log('After click tracking:');
        console.log(`  - Clicked: ${updatedRecipient2?.clicked} (count: ${updatedRecipient2?.clickCount})`);
        console.log(`  - Campaign analytics.clicked: ${updatedCampaign2?.analytics?.clicked}`);
      } catch (error) {
        if (error.response && error.response.status === 301) {
          console.log('✅ Click tracking request successful (redirected)');
        } else {
          console.log('❌ Click tracking failed:', error.message);
        }
      }
      
      // Show final campaign analytics
      const finalCampaign = await db.collection('campaigns').findOne({ _id: campaign._id });
      console.log('\n📊 Final Campaign Analytics:');
      console.log(finalCampaign.analytics);
      
      // Show final recipient status
      const finalRecipient = finalCampaign.recipients?.find(r => r.email === recipient.email);
      console.log('\n👤 Final Recipient Status:');
      console.log({
        email: finalRecipient?.email,
        sent: finalRecipient?.sent,
        delivered: finalRecipient?.delivered,
        opened: finalRecipient?.opened,
        openCount: finalRecipient?.openCount,
        clicked: finalRecipient?.clicked,
        clickCount: finalRecipient?.clickCount,
      });
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n✅ Test completed');
  }
}

testNewTracking();