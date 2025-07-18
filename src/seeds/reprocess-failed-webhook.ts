import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { StripeService } from '../payments/stripe/stripe.service';
import { Model } from 'mongoose';

async function reprocessFailedWebhook() {
  const app = await NestFactory.createApplicationContext(AppModule);

  try {
    const stripeService = app.get(StripeService);
    const webhookEventModel = app.get('WebhookEventModel') as Model<any>;

    console.log('🔍 Looking for failed webhook events...\n');

    // Find the specific failed event
    const failedEvent = await webhookEventModel
      .findOne({
        stripeEventId: 'evt_1RjlJpJ1acFkbhNIqX9faSHo',
        status: 'failed',
      })
      .exec();

    if (!failedEvent) {
      console.log('❌ Failed event not found');
      return;
    }

    console.log('📥 Found failed webhook event');
    console.log(`  Event ID: ${failedEvent.stripeEventId}`);
    console.log(`  Type: ${failedEvent.eventType}`);
    console.log(`  Original Error: ${failedEvent.errorMessage}`);

    // Manually process the event data
    const sessionData = failedEvent.eventData;

    console.log('\n🔧 Manually creating transaction...');

    // Create transaction directly
    const transactionModel = app.get('TransactionModel') as Model<any>;

    const transaction = await transactionModel.create({
      userId: sessionData.metadata.userId || undefined, // Make it optional
      amount: sessionData.amount_total / 100,
      currency: sessionData.currency,
      status: 'succeeded',
      plan: 'MasterCourse',
      type: 'event_payment',
      stripeSessionId: sessionData.id,
      stripeCustomerId: sessionData.customer,
      stripePaymentIntentId: sessionData.payment_intent,
      paymentMethod: 'card',
      billingCycle: 'one_time',
      metadata: {
        eventId: sessionData.metadata.eventId,
        eventType: sessionData.metadata.eventType,
        eventName: 'Master Trading Course',
        firstName: sessionData.metadata.firstName,
        lastName: sessionData.metadata.lastName,
        email: sessionData.metadata.email,
        phoneNumber: sessionData.metadata.phoneNumber,
        registrationType: sessionData.metadata.registrationType,
      },
    });

    console.log(`✅ Transaction created: ${transaction._id}`);

    // Update webhook event status
    failedEvent.status = 'processed';
    failedEvent.processedAt = new Date();
    failedEvent.errorMessage =
      'Manually reprocessed after fixing userId requirement';
    await failedEvent.save();

    console.log('✅ Webhook event marked as processed');
  } catch (error) {
    console.error('❌ Error reprocessing webhook:', error);
  } finally {
    await app.close();
  }
}

// Run the reprocess
reprocessFailedWebhook()
  .then(() => {
    console.log('\n✅ Reprocess complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Reprocess failed:', error);
    process.exit(1);
  });
