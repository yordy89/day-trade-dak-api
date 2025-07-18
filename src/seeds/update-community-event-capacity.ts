import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { Model } from 'mongoose';

async function updateCommunityEventCapacity() {
  const app = await NestFactory.createApplicationContext(AppModule);

  try {
    const eventModel = app.get('EventModel') as Model<any>;

    console.log('🔧 Updating Community Event Capacity...\n');

    // Find the community event
    const communityEvent = await eventModel
      .findOne({
        type: 'community_event',
        name: 'Trading Paradise Cancún 2025',
      })
      .exec();

    if (!communityEvent) {
      console.log('❌ Community event not found');
      return;
    }

    console.log(`📋 Current capacity: ${communityEvent.capacity}`);

    // Update capacity to 30
    communityEvent.capacity = 30;
    await communityEvent.save();

    console.log('✅ Community event capacity updated to 30 spots!');
    console.log(`   ID: ${communityEvent._id}`);
    console.log(`   Name: ${communityEvent.name}`);
    console.log(`   New Capacity: ${communityEvent.capacity} attendees`);
  } catch (error) {
    console.error('❌ Error updating community event:', error);
  } finally {
    await app.close();
  }
}

// Run the update
updateCommunityEventCapacity()
  .then(() => {
    console.log('\n✅ Update complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Update failed:', error);
    process.exit(1);
  });
