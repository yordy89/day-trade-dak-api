// Script to fix delivered status for existing analytics
const mongoose = require('mongoose');
require('dotenv').config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/daytradedak';

async function fixDeliveredStatus() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB');
    
    const db = mongoose.connection.db;
    
    // Update all analytics records that have sent=true but delivered=false
    const result = await db.collection('campaignanalytics').updateMany(
      { 
        sent: true,
        delivered: false
      },
      {
        $set: {
          delivered: true,
          deliveredAt: new Date()
        }
      }
    );
    
    console.log(`Updated ${result.modifiedCount} analytics records to set delivered=true`);
    
    // Now recalculate campaign analytics for all campaigns
    const campaigns = await db.collection('campaigns').find({ status: 'sent' }).toArray();
    
    for (const campaign of campaigns) {
      const analytics = await db.collection('campaignanalytics').find({
        campaignId: campaign._id.toString()
      }).toArray();
      
      const summary = {
        sent: analytics.filter(a => a.sent).length,
        delivered: analytics.filter(a => a.delivered).length,
        opened: analytics.filter(a => a.opened).length,
        clicked: analytics.filter(a => a.clicked).length,
        bounced: analytics.filter(a => a.bounced).length,
        unsubscribed: analytics.filter(a => a.unsubscribed).length,
      };
      
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
      
      console.log(`Updated campaign ${campaign.name}: ${JSON.stringify(summary)}`);
    }
    
    console.log('\nFixed all delivered statuses successfully!');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

fixDeliveredStatus();