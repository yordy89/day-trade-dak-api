// Migration script to update existing campaigns to use the new recipients structure
const mongoose = require('mongoose');
require('dotenv').config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/daytradedak';

async function migrateRecipients() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB');
    
    const db = mongoose.connection.db;
    
    // Get all campaigns with recipientEmails but no recipients array
    const campaigns = await db.collection('campaigns').find({
      recipientEmails: { $exists: true, $ne: [] },
      recipients: { $exists: false }
    }).toArray();
    
    console.log(`Found ${campaigns.length} campaigns to migrate`);
    
    for (const campaign of campaigns) {
      console.log(`\nMigrating campaign: ${campaign.name} (${campaign._id})`);
      
      // Get analytics for this campaign
      const analytics = await db.collection('campaignanalytics').find({
        campaignId: campaign._id.toString()
      }).toArray();
      
      console.log(`  Found ${analytics.length} analytics records`);
      
      // Create recipients array from recipientEmails and analytics
      const recipients = [];
      
      for (const email of campaign.recipientEmails) {
        // Find analytics for this email
        const analyticsRecord = analytics.find(a => a.recipientEmail === email);
        
        if (analyticsRecord) {
          // Use analytics data
          recipients.push({
            email: email,
            sent: analyticsRecord.sent || false,
            sentAt: analyticsRecord.sentAt || analyticsRecord.createdAt,
            delivered: analyticsRecord.delivered || false,
            deliveredAt: analyticsRecord.deliveredAt,
            opened: analyticsRecord.opened || false,
            openedAt: analyticsRecord.firstOpenedAt,
            openCount: analyticsRecord.openCount || 0,
            clicked: analyticsRecord.clicked || false,
            clickedAt: analyticsRecord.firstClickedAt,
            clickCount: analyticsRecord.clickCount || 0,
            bounced: analyticsRecord.bounced || false,
            bouncedAt: analyticsRecord.bouncedAt,
            unsubscribed: analyticsRecord.unsubscribed || false,
            unsubscribedAt: analyticsRecord.unsubscribedAt,
          });
        } else {
          // No analytics found, create default
          recipients.push({
            email: email,
            sent: campaign.status === 'sent',
            sentAt: campaign.sentDate,
            delivered: campaign.status === 'sent',
            deliveredAt: campaign.sentDate,
            opened: false,
            openCount: 0,
            clicked: false,
            clickCount: 0,
            bounced: false,
            unsubscribed: false,
          });
        }
      }
      
      // Update campaign with recipients array
      const updateResult = await db.collection('campaigns').updateOne(
        { _id: campaign._id },
        {
          $set: {
            recipients: recipients
          }
        }
      );
      
      console.log(`  Updated campaign with ${recipients.length} recipients`);
      
      // Recalculate analytics based on recipients
      const summary = {
        sent: recipients.filter(r => r.sent).length,
        delivered: recipients.filter(r => r.delivered).length,
        opened: recipients.filter(r => r.opened).length,
        clicked: recipients.filter(r => r.clicked).length,
        bounced: recipients.filter(r => r.bounced).length,
        unsubscribed: recipients.filter(r => r.unsubscribed).length,
      };
      
      // Update campaign analytics
      await db.collection('campaigns').updateOne(
        { _id: campaign._id },
        {
          $set: {
            'analytics.sent': summary.sent,
            'analytics.delivered': summary.delivered,
            'analytics.opened': summary.opened,
            'analytics.clicked': summary.clicked,
            'analytics.bounced': summary.bounced,
            'analytics.unsubscribed': summary.unsubscribed,
          }
        }
      );
      
      console.log(`  Updated analytics: ${JSON.stringify(summary)}`);
    }
    
    console.log('\n✅ Migration completed successfully!');
    
    // Show summary
    const totalCampaigns = await db.collection('campaigns').countDocuments({});
    const migratedCampaigns = await db.collection('campaigns').countDocuments({
      recipients: { $exists: true }
    });
    
    console.log(`\nSummary:`);
    console.log(`  Total campaigns: ${totalCampaigns}`);
    console.log(`  Migrated campaigns: ${migratedCampaigns}`);
    
  } catch (error) {
    console.error('Migration error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
  }
}

migrateRecipients();