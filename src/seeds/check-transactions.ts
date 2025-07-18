import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { Model } from 'mongoose';

async function checkTransactions() {
  const app = await NestFactory.createApplicationContext(AppModule);

  try {
    const transactionModel = app.get('TransactionModel') as Model<any>;
    const eventRegistrationModel = app.get(
      'EventRegistrationModel',
    ) as Model<any>;

    console.log('🔍 Checking Transaction Records...\n');

    // Get all transactions
    const allTransactions = await transactionModel
      .find({})
      .sort({ createdAt: -1 })
      .limit(10)
      .exec();
    console.log(`Total recent transactions: ${allTransactions.length}`);

    // Check for event payment transactions
    const eventTransactions = await transactionModel
      .find({
        type: 'event_payment',
      })
      .exec();

    console.log(`\n💳 Event Payment Transactions: ${eventTransactions.length}`);

    if (eventTransactions.length > 0) {
      eventTransactions.forEach((tx, index) => {
        console.log(`\nTransaction ${index + 1}:`);
        console.log(`  ID: ${tx._id}`);
        console.log(`  Amount: $${tx.amount}`);
        console.log(`  Status: ${tx.status}`);
        console.log(`  Plan: ${tx.plan}`);
        console.log(`  Type: ${tx.type}`);
        console.log(`  User ID: ${tx.userId || 'Guest'}`);
        console.log(`  Created: ${tx.createdAt}`);
        if (tx.metadata) {
          console.log(`  Event ID: ${tx.metadata.eventId}`);
          console.log(`  Event Type: ${tx.metadata.eventType}`);
          console.log(`  Event Name: ${tx.metadata.eventName}`);
          console.log(
            `  Customer: ${tx.metadata.firstName} ${tx.metadata.lastName} (${tx.metadata.email})`,
          );
        }
      });
    }

    // Check transactions without type field (legacy)
    const legacyTransactions = await transactionModel
      .find({
        type: { $exists: false },
        plan: { $in: ['MasterCourse', 'CommunityEvent'] },
      })
      .exec();

    console.log(
      `\n⚠️  Legacy Event Transactions (no type field): ${legacyTransactions.length}`,
    );

    // Check event registrations
    const eventRegistrations = await eventRegistrationModel
      .find({})
      .limit(10)
      .exec();
    console.log(`\n📋 Event Registrations: ${eventRegistrations.length}`);

    if (eventRegistrations.length > 0) {
      eventRegistrations.forEach((reg, index) => {
        console.log(`\nRegistration ${index + 1}:`);
        console.log(`  Event ID: ${reg.eventId}`);
        console.log(`  Name: ${reg.firstName} ${reg.lastName}`);
        console.log(`  Email: ${reg.email}`);
        console.log(`  Payment Status: ${reg.paymentStatus}`);
        console.log(`  Amount Paid: $${reg.amountPaid || 0}`);
        console.log(`  Created: ${reg.createdAt}`);
      });
    }

    // Summary
    console.log('\n📊 Summary:');
    console.log(`  Total Transactions: ${allTransactions.length}`);
    console.log(`  Event Payment Transactions: ${eventTransactions.length}`);
    console.log(`  Legacy Event Transactions: ${legacyTransactions.length}`);
    console.log(`  Event Registrations: ${eventRegistrations.length}`);

    // Check if transactions are being created for recent registrations
    if (eventRegistrations.length > 0 && eventTransactions.length === 0) {
      console.log(
        '\n❌ WARNING: Event registrations exist but no event payment transactions found!',
      );
      console.log(
        '   This suggests transactions are not being created properly.',
      );
    }
  } catch (error) {
    console.error('❌ Error checking transactions:', error);
  } finally {
    await app.close();
  }
}

// Run the check
checkTransactions()
  .then(() => {
    console.log('\n✅ Check complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Check failed:', error);
    process.exit(1);
  });
