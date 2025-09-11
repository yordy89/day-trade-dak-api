// Script to manually test and fix tracking for a campaign
const mongoose = require('mongoose');
require('dotenv').config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/daytradedak';
const campaignId = '68c1cd9adc8d20cc6d01c81c';
const recipientEmail = 'yordyat1107@gmail.com';

async function fixTracking() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB');
    
    const db = mongoose.connection.db;
    
    // Check if analytics record exists
    const analytics = await db.collection('campaignanalytics').findOne({
      campaignId: campaignId,
      recipientEmail: recipientEmail
    });
    
    if (analytics) {
      console.log('Found existing analytics:', analytics);
    } else {
      console.log('No analytics record found, creating one...');
      
      // Create analytics record
      const result = await db.collection('campaignanalytics').insertOne({
        campaignId: campaignId,
        recipientEmail: recipientEmail,
        sent: true,
        sentAt: new Date(),
        delivered: true,
        deliveredAt: new Date(),
        opened: false,
        clicked: false,
        bounced: false,
        unsubscribed: false,
        openCount: 0,
        clickCount: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      
      console.log('Created analytics record:', result.insertedId);
    }
    
    // Now simulate opening the email
    console.log('\nSimulating email open...');
    const openResult = await db.collection('campaignanalytics').updateOne(
      { campaignId: campaignId, recipientEmail: recipientEmail },
      {
        $set: { 
          opened: true,
          firstOpenedAt: new Date()
        },
        $inc: { openCount: 1 }
      }
    );
    console.log('Open tracking result:', openResult.modifiedCount, 'document(s) modified');
    
    // Update campaign analytics
    const campaign = await db.collection('campaigns').findOne({ _id: new mongoose.Types.ObjectId(campaignId) });
    console.log('\nCampaign analytics before update:', campaign?.analytics);
    
    const campaignUpdateResult = await db.collection('campaigns').updateOne(
      { _id: new mongoose.Types.ObjectId(campaignId) },
      {
        $set: { 
          'analytics.opened': 1
        }
      }
    );
    console.log('Campaign update result:', campaignUpdateResult.modifiedCount, 'document(s) modified');
    
    // Verify the updates
    const updatedAnalytics = await db.collection('campaignanalytics').findOne({
      campaignId: campaignId,
      recipientEmail: recipientEmail
    });
    console.log('\nUpdated analytics record:', updatedAnalytics);
    
    const updatedCampaign = await db.collection('campaigns').findOne({ _id: new mongoose.Types.ObjectId(campaignId) });
    console.log('Updated campaign analytics:', updatedCampaign?.analytics);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
  }
}

fixTracking();