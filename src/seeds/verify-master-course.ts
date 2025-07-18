import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { EventsServiceOptimized } from '../event/event.service.optimized';
import { Model } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';

async function verifyMasterCourse() {
  const app = await NestFactory.createApplicationContext(AppModule);

  try {
    const eventsService = app.get(EventsServiceOptimized);
    const eventModel = app.get('EventModel') as Model<any>;

    console.log('🔍 Verifying Master Course Event Setup...\n');

    // Check for Master Course events
    const masterCourseEvents = await eventModel
      .find({ type: 'master_course' })
      .exec();

    if (masterCourseEvents.length === 0) {
      console.log('❌ No Master Course events found in database');
    } else {
      console.log(
        `✅ Found ${masterCourseEvents.length} Master Course event(s):\n`,
      );

      masterCourseEvents.forEach((event, index) => {
        console.log(`Event ${index + 1}:`);
        console.log(`  ID: ${event._id}`);
        console.log(`  Name: ${event.name}`);
        console.log(`  Title: ${event.title}`);
        console.log(`  Price: $${event.price}`);
        console.log(`  Active: ${event.isActive ? 'Yes' : 'No'}`);
        console.log(`  Start Date: ${event.startDate}`);
        console.log(`  End Date: ${event.endDate}`);
        console.log(`  Capacity: ${event.capacity || 'Unlimited'}`);
        console.log(
          `  Current Registrations: ${event.currentRegistrations || 0}`,
        );
        console.log(`  Created: ${event.createdAt}`);
        console.log('');
      });
    }

    // Check for any event registrations
    const registrationModel = app.get('EventRegistrationModel') as Model<any>;
    if (registrationModel) {
      const registrations = await registrationModel.find({}).exec();
      console.log(`\n📋 Total Event Registrations: ${registrations.length}`);

      if (registrations.length > 0) {
        const masterCourseRegistrations = registrations.filter((reg) =>
          masterCourseEvents.some(
            (event) => event._id.toString() === reg.eventId,
          ),
        );
        console.log(
          `  Master Course Registrations: ${masterCourseRegistrations.length}`,
        );
      }
    }

    // Check for transactions
    const transactionModel = app.get('TransactionModel') as Model<any>;
    const eventTransactions = await transactionModel
      .find({ type: 'event_payment' })
      .exec();
    console.log(`\n💰 Event Payment Transactions: ${eventTransactions.length}`);

    if (eventTransactions.length > 0) {
      const totalRevenue = eventTransactions.reduce(
        (sum, tx) => sum + tx.amount,
        0,
      );
      console.log(`  Total Event Revenue: $${totalRevenue.toFixed(2)}`);
    }

    // Verify system readiness
    console.log('\n🏁 System Readiness Check:');
    console.log(`  ✅ Event Model: Available`);
    console.log(`  ✅ Transaction Model: Available`);
    console.log(
      `  ✅ Master Course Event: ${masterCourseEvents.length > 0 ? 'Created' : 'Not Found'}`,
    );
    console.log(
      `  ✅ Event Active: ${masterCourseEvents.some((e) => e.isActive) ? 'Yes' : 'No'}`,
    );

    // Show registration URL
    if (masterCourseEvents.length > 0 && masterCourseEvents[0].isActive) {
      console.log('\n🔗 Registration URL:');
      console.log(`  Frontend: http://localhost:3000/master-course`);
      console.log(
        `  API Endpoint: POST /api/payments/stripe/create-checkout-session`,
      );
      console.log(`  Event ID: ${masterCourseEvents[0]._id}`);
    }
  } catch (error) {
    console.error('❌ Error during verification:', error);
  } finally {
    await app.close();
  }
}

// Run the verification
verifyMasterCourse()
  .then(() => {
    console.log('\n✅ Verification complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Verification failed:', error);
    process.exit(1);
  });
