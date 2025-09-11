// Script to check what data the analytics endpoint should return
const mongoose = require('mongoose');
require('dotenv').config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/daytradedak';
const campaignId = '68c1cd9adc8d20cc6d01c81c';

async function checkAnalyticsData() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB');
    
    const db = mongoose.connection.db;
    
    // Get campaign
    const campaign = await db.collection('campaigns').findOne({ 
      _id: new mongoose.Types.ObjectId(campaignId) 
    });
    console.log('\nCampaign:');
    console.log('- Name:', campaign?.name);
    console.log('- Status:', campaign?.status);
    console.log('- Analytics:', campaign?.analytics);
    console.log('- Recipient Emails:', campaign?.recipientEmails);
    
    // Get all analytics for this campaign
    const analytics = await db.collection('campaignanalytics').find({
      campaignId: campaignId
    }).toArray();
    
    console.log('\n\nAnalytics Records (' + analytics.length + ' total):');
    analytics.forEach((record, i) => {
      console.log(`\n${i + 1}. ${record.recipientEmail}`);
      console.log('   _id:', record._id);
      console.log('   sent:', record.sent);
      console.log('   delivered:', record.delivered);
      console.log('   opened:', record.opened, '(count:', record.openCount + ')');
      console.log('   clicked:', record.clicked, '(count:', record.clickCount + ')');
      console.log('   bounced:', record.bounced);
      console.log('   unsubscribed:', record.unsubscribed);
      console.log('   sentAt:', record.sentAt);
      console.log('   firstOpenedAt:', record.firstOpenedAt);
      console.log('   firstClickedAt:', record.firstClickedAt);
    });
    
    // Calculate summary
    const summary = {
      sent: analytics.filter(a => a.sent || a.delivered).length,
      delivered: analytics.filter(a => a.delivered).length,
      opened: analytics.filter(a => a.opened).length,
      clicked: analytics.filter(a => a.clicked).length,
      bounced: analytics.filter(a => a.bounced).length,
      unsubscribed: analytics.filter(a => a.unsubscribed).length,
    };
    
    console.log('\n\nCalculated Summary:');
    console.log(summary);
    
    console.log('\nCalculated Rates:');
    console.log('- Open Rate:', summary.delivered > 0 ? ((summary.opened / summary.delivered) * 100).toFixed(2) + '%' : '0%');
    console.log('- Click Rate:', summary.opened > 0 ? ((summary.clicked / summary.opened) * 100).toFixed(2) + '%' : '0%');
    
    console.log('\n\nExpected API Response Structure:');
    const expectedResponse = {
      summary,
      deliveryRate: summary.sent > 0 ? (summary.delivered / summary.sent) * 100 : 0,
      openRate: summary.delivered > 0 ? (summary.opened / summary.delivered) * 100 : 0,
      clickRate: summary.opened > 0 ? (summary.clicked / summary.opened) * 100 : 0,
      bounceRate: summary.sent > 0 ? (summary.bounced / summary.sent) * 100 : 0,
      unsubscribeRate: summary.delivered > 0 ? (summary.unsubscribed / summary.delivered) * 100 : 0,
      recipients: analytics
    };
    
    console.log(JSON.stringify(expectedResponse, null, 2));
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n\nDisconnected from MongoDB');
  }
}

checkAnalyticsData();