// Script to fix open tracking for existing campaigns
const mongoose = require('mongoose');
require('dotenv').config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/daytradedak';

async function fixOpenTracking() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB');
    
    const db = mongoose.connection.db;
    
    // Get all campaigns
    const campaigns = await db.collection('campaigns').find({
      status: 'sent'
    }).toArray();
    
    console.log(`Found ${campaigns.length} sent campaigns to check`);
    
    for (const campaign of campaigns) {
      console.log(`\n📧 Processing campaign: ${campaign.name} (${campaign._id})`);
      
      // Get all analytics records for this campaign
      const analyticsRecords = await db.collection('campaignanalytics').find({
        campaignId: campaign._id.toString()
      }).toArray();
      
      console.log(`  Found ${analyticsRecords.length} analytics records`);
      
      // The existence of an analytics record means the email was at least sent
      // If there's a clickCount > 0, the email was definitely opened
      let openedCount = 0;
      let deliveredCount = 0;
      
      for (const record of analyticsRecords) {
        let shouldMarkOpened = false;
        
        // If clicked, it was definitely opened
        if (record.clicked || record.clickCount > 0) {
          shouldMarkOpened = true;
        }
        
        // If there's an analytics record, mark as delivered
        await db.collection('campaignanalytics').updateOne(
          { _id: record._id },
          {
            $set: {
              delivered: true,
              deliveredAt: record.deliveredAt || record.sentAt || record.createdAt,
              opened: shouldMarkOpened || record.opened || false,
              firstOpenedAt: shouldMarkOpened ? (record.firstOpenedAt || record.firstClickedAt || new Date()) : record.firstOpenedAt
            }
          }
        );
        
        if (shouldMarkOpened || record.opened) {
          openedCount++;
        }
        deliveredCount++;
        
        console.log(`  - ${record.recipientEmail}: delivered=true, opened=${shouldMarkOpened || record.opened}`);
      }
      
      // Update campaign recipients array if it exists
      if (campaign.recipients && campaign.recipients.length > 0) {
        for (const recipient of campaign.recipients) {
          const analyticsRecord = analyticsRecords.find(a => a.recipientEmail === recipient.email);
          
          if (analyticsRecord) {
            await db.collection('campaigns').updateOne(
              {
                _id: campaign._id,
                'recipients.email': recipient.email
              },
              {
                $set: {
                  'recipients.$.delivered': true,
                  'recipients.$.opened': analyticsRecord.opened || analyticsRecord.clicked || false,
                  'recipients.$.openCount': analyticsRecord.openCount || (analyticsRecord.opened ? 1 : 0),
                  'recipients.$.clicked': analyticsRecord.clicked || false,
                  'recipients.$.clickCount': analyticsRecord.clickCount || 0,
                }
              }
            );
          }
        }
      }
      
      // Update campaign analytics
      await db.collection('campaigns').updateOne(
        { _id: campaign._id },
        {
          $set: {
            'analytics.sent': analyticsRecords.length,
            'analytics.delivered': deliveredCount,
            'analytics.opened': openedCount,
          }
        }
      );
      
      console.log(`  ✅ Updated campaign analytics: delivered=${deliveredCount}, opened=${openedCount}`);
    }
    
    console.log('\n🎉 Open tracking fix completed!');
    
    // Test by triggering an open event for the latest campaign
    const latestCampaign = campaigns[campaigns.length - 1];
    if (latestCampaign && latestCampaign.recipientEmails && latestCampaign.recipientEmails.length > 0) {
      console.log(`\n🧪 Testing open tracking for campaign: ${latestCampaign._id}`);
      const testEmail = latestCampaign.recipientEmails[0];
      
      // Simulate an open
      await db.collection('campaignanalytics').updateOne(
        {
          campaignId: latestCampaign._id.toString(),
          recipientEmail: testEmail
        },
        {
          $set: {
            opened: true,
            firstOpenedAt: new Date(),
          },
          $inc: { openCount: 1 }
        },
        { upsert: true }
      );
      
      // Update campaign
      await db.collection('campaigns').updateOne(
        {
          _id: latestCampaign._id,
          'recipients.email': testEmail
        },
        {
          $set: {
            'recipients.$.opened': true,
            'recipients.$.openedAt': new Date(),
          },
          $inc: {
            'recipients.$.openCount': 1
          }
        }
      );
      
      // Increment campaign opened count
      await db.collection('campaigns').updateOne(
        { _id: latestCampaign._id },
        { $inc: { 'analytics.opened': 1 } }
      );
      
      console.log(`  ✅ Simulated open for ${testEmail}`);
      
      // Verify
      const updatedCampaign = await db.collection('campaigns').findOne({ _id: latestCampaign._id });
      console.log(`  Campaign analytics: ${JSON.stringify(updatedCampaign.analytics)}`);
      
      const updatedRecipient = updatedCampaign.recipients?.find(r => r.email === testEmail);
      console.log(`  Recipient status: opened=${updatedRecipient?.opened}, openCount=${updatedRecipient?.openCount}`);
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
  }
}

fixOpenTracking();