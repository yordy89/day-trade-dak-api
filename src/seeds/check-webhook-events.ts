import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { Model } from 'mongoose';

async function checkWebhookEvents() {
  const app = await NestFactory.createApplicationContext(AppModule);

  try {
    const webhookEventModel = app.get('WebhookEventModel') as Model<any>;

    console.log('🔍 Checking Webhook Events...\n');

    // Get recent webhook events
    const recentEvents = await webhookEventModel
      .find({})
      .sort({ createdAt: -1 })
      .limit(20)
      .exec();

    console.log(`Total recent webhook events: ${recentEvents.length}\n`);

    // Group by event type
    const eventTypes = {};
    recentEvents.forEach((event) => {
      if (!eventTypes[event.eventType]) {
        eventTypes[event.eventType] = 0;
      }
      eventTypes[event.eventType]++;
    });

    console.log('Event Types:');
    Object.entries(eventTypes).forEach(([type, count]) => {
      console.log(`  ${type}: ${count}`);
    });

    // Check for checkout.session.completed events
    const checkoutEvents = recentEvents.filter(
      (e) => e.eventType === 'checkout.session.completed',
    );
    console.log(
      `\n💳 Checkout Session Completed Events: ${checkoutEvents.length}`,
    );

    if (checkoutEvents.length > 0) {
      checkoutEvents.forEach((event, index) => {
        console.log(`\nEvent ${index + 1}:`);
        console.log(`  ID: ${event.stripeEventId}`);
        console.log(`  Status: ${event.status}`);
        console.log(`  Created: ${event.createdAt}`);

        if (event.eventData) {
          console.log(`  Session ID: ${event.eventData.id}`);
          console.log(
            `  Amount: $${event.eventData.amount_total ? event.eventData.amount_total / 100 : 0}`,
          );
          console.log(`  Payment Status: ${event.eventData.payment_status}`);

          if (event.eventData.metadata) {
            console.log(`  Metadata:`);
            Object.entries(event.eventData.metadata).forEach(([key, value]) => {
              console.log(`    ${key}: ${value}`);
            });
          }
        }

        if (event.status === 'failed') {
          console.log(`  ❌ Error: ${event.errorMessage}`);
        }
      });
    }

    // Check for failed events
    const failedEvents = recentEvents.filter((e) => e.status === 'failed');
    if (failedEvents.length > 0) {
      console.log(`\n❌ Failed Events: ${failedEvents.length}`);
      failedEvents.forEach((event, index) => {
        console.log(`\nFailed Event ${index + 1}:`);
        console.log(`  Type: ${event.eventType}`);
        console.log(`  Error: ${event.errorMessage}`);
        console.log(`  Created: ${event.createdAt}`);
      });
    }
  } catch (error) {
    console.error('❌ Error checking webhook events:', error);
  } finally {
    await app.close();
  }
}

// Run the check
checkWebhookEvents()
  .then(() => {
    console.log('\n✅ Check complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Check failed:', error);
    process.exit(1);
  });
