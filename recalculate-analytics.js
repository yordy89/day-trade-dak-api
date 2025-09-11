// Script to recalculate campaign analytics correctly
const mongoose = require('mongoose');
require('dotenv').config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/daytradedak';

async function recalculateAnalytics() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB');
    
    const db = mongoose.connection.db;
    
    // Get all campaigns
    const campaigns = await db.collection('campaigns').find({}).toArray();
    
    console.log(`Found ${campaigns.length} campaigns to recalculate`);
    
    for (const campaign of campaigns) {
      console.log(`\n📊 Recalculating: ${campaign.name} (${campaign._id})`);
      
      // Get unique analytics records for this campaign
      const analyticsRecords = await db.collection('campaignanalytics').find({
        campaignId: campaign._id.toString()
      }).toArray();
      
      // Calculate unique counts
      const uniqueMetrics = {
        sent: 0,
        delivered: 0,
        opened: 0,
        clicked: 0,
        bounced: 0,
        unsubscribed: 0
      };
      
      for (const record of analyticsRecords) {
        if (record.sent) uniqueMetrics.sent++;
        if (record.delivered) uniqueMetrics.delivered++;
        if (record.opened) uniqueMetrics.opened++;
        if (record.clicked) uniqueMetrics.clicked++;
        if (record.bounced) uniqueMetrics.bounced++;
        if (record.unsubscribed) uniqueMetrics.unsubscribed++;
      }
      
      // Also check recipients array if it exists
      if (campaign.recipients && campaign.recipients.length > 0) {
        const recipientMetrics = {
          sent: campaign.recipients.filter(r => r.sent).length,
          delivered: campaign.recipients.filter(r => r.delivered).length,
          opened: campaign.recipients.filter(r => r.opened).length,
          clicked: campaign.recipients.filter(r => r.clicked).length,
          bounced: campaign.recipients.filter(r => r.bounced).length,
          unsubscribed: campaign.recipients.filter(r => r.unsubscribed).length
        };
        
        // Use the maximum of both sources
        uniqueMetrics.sent = Math.max(uniqueMetrics.sent, recipientMetrics.sent);
        uniqueMetrics.delivered = Math.max(uniqueMetrics.delivered, recipientMetrics.delivered);
        uniqueMetrics.opened = Math.max(uniqueMetrics.opened, recipientMetrics.opened);
        uniqueMetrics.clicked = Math.max(uniqueMetrics.clicked, recipientMetrics.clicked);
        uniqueMetrics.bounced = Math.max(uniqueMetrics.bounced, recipientMetrics.bounced);
        uniqueMetrics.unsubscribed = Math.max(uniqueMetrics.unsubscribed, recipientMetrics.unsubscribed);
      }
      
      // Update campaign analytics with correct unique counts
      await db.collection('campaigns').updateOne(
        { _id: campaign._id },
        {
          $set: {
            'analytics.sent': uniqueMetrics.sent,
            'analytics.delivered': uniqueMetrics.delivered,
            'analytics.opened': uniqueMetrics.opened,
            'analytics.clicked': uniqueMetrics.clicked,
            'analytics.bounced': uniqueMetrics.bounced,
            'analytics.unsubscribed': uniqueMetrics.unsubscribed,
          }
        }
      );
      
      console.log(`  Before: ${JSON.stringify(campaign.analytics)}`);
      console.log(`  After: ${JSON.stringify(uniqueMetrics)}`);
      
      // Calculate rates
      const openRate = uniqueMetrics.delivered > 0 
        ? (uniqueMetrics.opened / uniqueMetrics.delivered * 100).toFixed(2)
        : '0.00';
      const clickRate = uniqueMetrics.opened > 0 
        ? (uniqueMetrics.clicked / uniqueMetrics.opened * 100).toFixed(2)
        : '0.00';
      
      console.log(`  Open Rate: ${openRate}%`);
      console.log(`  Click Rate: ${clickRate}%`);
    }
    
    console.log('\n✅ Analytics recalculation completed!');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
  }
}

recalculateAnalytics();