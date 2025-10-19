const mongoose = require('mongoose');
require('dotenv').config();

async function fixPartialPayments() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    const EventRegistration = mongoose.connection.collection('eventregistrations');
    const EventPaymentTracker = mongoose.connection.collection('eventpaymenttrackers');

    // Find all registrations with partial payment mode
    const registrations = await EventRegistration.find({ paymentMode: 'partial' }).toArray();
    
    console.log(`Found ${registrations.length} partial payment registrations`);

    for (const reg of registrations) {
      console.log(`\nProcessing registration: ${reg._id}`);
      console.log(`Current totalPaid: ${reg.totalPaid}, totalAmount: ${reg.totalAmount}`);

      // Get all completed payments for this registration
      const payments = await EventPaymentTracker.find({
        registrationId: reg._id,
        status: 'completed'
      }).toArray();

      console.log(`Found ${payments.length} completed payments`);

      // Calculate total from completed payments
      const calculatedTotal = payments.reduce((sum, p) => sum + (p.amount || 0), 0);
      const totalAmount = reg.totalAmount || 3000; // Default if not set
      const remainingBalance = totalAmount - calculatedTotal;

      console.log(`Calculated totalPaid: ${calculatedTotal}`);
      console.log(`Remaining balance: ${remainingBalance}`);

      // Update the registration
      await EventRegistration.updateOne(
        { _id: reg._id },
        {
          $set: {
            totalPaid: calculatedTotal,
            totalAmount: totalAmount,
            remainingBalance: Math.max(0, remainingBalance),
            isFullyPaid: remainingBalance <= 0,
            paymentStatus: remainingBalance <= 0 ? 'paid' : 'pending'
          }
        }
      );

      console.log(`✅ Updated registration ${reg._id}`);
    }

    console.log('\n✅ Migration complete!');
    await mongoose.disconnect();
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

fixPartialPayments();
