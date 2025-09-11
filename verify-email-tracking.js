// Script to verify that tracking pixels are embedded in sent emails
const mongoose = require('mongoose');
require('dotenv').config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/daytradedak';

async function verifyEmailTracking() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB\n');
    
    const db = mongoose.connection.db;
    
    // Get the latest sent campaign
    const campaign = await db.collection('campaigns').findOne({
      status: 'sent'
    }, { sort: { sentDate: -1 } });
    
    if (!campaign) {
      console.log('No sent campaigns found');
      return;
    }
    
    console.log('📧 Campaign:', campaign.name);
    console.log('Campaign ID:', campaign._id);
    console.log('Status:', campaign.status);
    console.log('Sent Date:', campaign.sentDate);
    console.log('Recipients:', campaign.recipientEmails);
    
    // Check if HTML content has tracking pixel
    const htmlContent = campaign.htmlContent || '';
    const hasTrackingPixel = htmlContent.includes('/email-marketing/tracking/open/');
    const hasTrackedLinks = htmlContent.includes('/email-marketing/tracking/click/');
    
    console.log('\n🔍 Email Content Analysis:');
    console.log('Has tracking pixel:', hasTrackingPixel ? '✅ YES' : '❌ NO');
    console.log('Has tracked links:', hasTrackedLinks ? '✅ YES' : '❌ NO');
    
    if (hasTrackingPixel) {
      // Extract tracking pixel URL
      const pixelMatch = htmlContent.match(/<img[^>]*src="([^"]*\/email-marketing\/tracking\/open\/[^"]+)"/);
      if (pixelMatch) {
        console.log('\n📍 Tracking Pixel URL:');
        console.log(pixelMatch[1]);
        
        // Parse the URL to get campaign ID and email
        const urlParts = pixelMatch[1].match(/\/open\/([^\/]+)\/([^\.]+)\.png/);
        if (urlParts) {
          console.log('  - Campaign ID in pixel:', urlParts[1]);
          console.log('  - Email in pixel:', decodeURIComponent(urlParts[2]));
        }
      }
    }
    
    if (hasTrackedLinks) {
      // Extract tracked links
      const linkMatches = htmlContent.match(/href="([^"]*\/email-marketing\/tracking\/click\/[^"]+)"/g);
      if (linkMatches && linkMatches.length > 0) {
        console.log('\n🔗 Tracked Links Found:', linkMatches.length);
        linkMatches.slice(0, 3).forEach((match, i) => {
          const url = match.match(/href="([^"]+)"/)[1];
          console.log(`  ${i + 1}. ${url.substring(0, 100)}...`);
        });
      }
    }
    
    // Check current analytics
    console.log('\n📊 Current Campaign Analytics:');
    console.log(JSON.stringify(campaign.analytics, null, 2));
    
    // Check analytics records
    const analyticsRecords = await db.collection('campaignanalytics').find({
      campaignId: campaign._id.toString()
    }).toArray();
    
    console.log('\n📈 Analytics Records:', analyticsRecords.length);
    analyticsRecords.forEach(record => {
      console.log(`  - ${record.recipientEmail}:`);
      console.log(`    • Sent: ${record.sent}`);
      console.log(`    • Delivered: ${record.delivered}`);
      console.log(`    • Opened: ${record.opened} (count: ${record.openCount || 0})`);
      console.log(`    • Clicked: ${record.clicked} (count: ${record.clickCount || 0})`);
    });
    
    // Check if recipients array has data
    if (campaign.recipients && campaign.recipients.length > 0) {
      console.log('\n👥 Recipients Array Status:');
      campaign.recipients.forEach(r => {
        console.log(`  - ${r.email}:`);
        console.log(`    • Opened: ${r.opened} (count: ${r.openCount || 0})`);
        console.log(`    • Clicked: ${r.clicked} (count: ${r.clickCount || 0})`);
      });
    }
    
    // Provide instructions for testing
    console.log('\n📝 To Test Automatic Tracking:');
    console.log('1. Send a test campaign to your email');
    console.log('2. Open the email in your email client');
    console.log('3. The tracking pixel should load automatically');
    console.log('4. Click any link in the email');
    console.log('5. Check the analytics again to see if they updated');
    
    if (!hasTrackingPixel || !hasTrackedLinks) {
      console.log('\n⚠️  WARNING: Tracking may not be working!');
      console.log('The email content does not contain tracking elements.');
      console.log('This could mean:');
      console.log('  1. The email was sent before tracking was implemented');
      console.log('  2. The addEmailTracking() function is not being called');
      console.log('  3. There is an issue with the tracking implementation');
      console.log('\nTry sending a new test campaign to verify tracking is added.');
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n✅ Verification completed');
  }
}

verifyEmailTracking();