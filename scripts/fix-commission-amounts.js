const mongoose = require('mongoose');
require('dotenv').config();

// Define schemas
const commissionSchema = new mongoose.Schema({
  affiliateId: String,
  affiliateCode: String,
  registrationId: String,
  customerEmail: String,
  customerName: String,
  originalPrice: Number,
  discountAmount: Number,
  finalPrice: Number,
  commissionType: { type: String, enum: ['percentage', 'fixed'] },
  commissionRate: Number,
  commissionFixedAmount: Number,
  commissionAmount: Number,
  stripeSessionId: String,
  stripePaymentIntentId: String,
  paymentMethod: String,
  status: { type: String, enum: ['pending', 'approved', 'paid', 'cancelled'] },
  paidAt: Date,
  metadata: Object,
  createdAt: Date,
  updatedAt: Date,
});

const affiliateSchema = new mongoose.Schema({
  affiliateCode: String,
  name: String,
  email: String,
  phoneNumber: String,
  discountType: { type: String, enum: ['percentage', 'fixed'], default: 'percentage' },
  discountPercentage: Number,
  discountFixedAmount: Number,
  commissionType: { type: String, enum: ['percentage', 'fixed'], default: 'percentage' },
  commissionRate: Number,
  commissionFixedAmount: Number,
  isActive: Boolean,
  totalSales: Number,
  totalCommission: Number,
  totalRevenue: Number,
  stripeCouponId: String,
  stripePromotionCodeId: String,
});

const Commission = mongoose.model('Commission', commissionSchema);
const Affiliate = mongoose.model('Affiliate', affiliateSchema);

async function fixCommissionAmounts() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB\n');
    
    // Find all commissions with 0 amount
    const zeroCommissions = await Commission.find({ commissionAmount: 0 });
    console.log(`Found ${zeroCommissions.length} commissions with $0 amount\n`);
    
    for (const commission of zeroCommissions) {
      // Find the affiliate to get commission details
      const affiliate = await Affiliate.findById(commission.affiliateId);
      
      if (!affiliate) {
        console.log(`⚠️  Affiliate not found for commission ${commission._id}`);
        continue;
      }
      
      console.log(`Processing commission for ${commission.customerEmail}:`);
      console.log(`  Affiliate: ${affiliate.name} (${affiliate.affiliateCode})`);
      console.log(`  Final Price: $${commission.finalPrice}`);
      
      // Calculate correct commission amount
      let calculatedAmount = 0;
      if (affiliate.commissionType === 'fixed') {
        calculatedAmount = affiliate.commissionFixedAmount || 0;
        console.log(`  Commission Type: Fixed - $${calculatedAmount}`);
      } else {
        const rate = affiliate.commissionRate || 0;
        calculatedAmount = (commission.finalPrice * rate) / 100;
        console.log(`  Commission Type: Percentage - ${rate}% = $${calculatedAmount.toFixed(2)}`);
      }
      
      // Update the commission
      if (calculatedAmount > 0) {
        await Commission.findByIdAndUpdate(commission._id, {
          commissionAmount: calculatedAmount,
          commissionType: affiliate.commissionType,
          commissionRate: affiliate.commissionRate,
          commissionFixedAmount: affiliate.commissionFixedAmount,
        });
        
        console.log(`  ✅ Updated commission amount to $${calculatedAmount.toFixed(2)}\n`);
        
        // Update affiliate totals
        await Affiliate.findByIdAndUpdate(affiliate._id, {
          $inc: {
            totalCommission: calculatedAmount
          }
        });
      } else {
        console.log(`  ⚠️  Could not calculate commission amount\n`);
      }
    }
    
    console.log('\n=== VERIFICATION ===\n');
    
    // Show all commissions after fix
    const allCommissions = await Commission.find().populate('affiliateId');
    for (const commission of allCommissions) {
      console.log(`${commission.customerEmail}:`);
      console.log(`  Code: ${commission.affiliateCode}`);
      console.log(`  Final Price: $${commission.finalPrice}`);
      console.log(`  Commission: $${commission.commissionAmount}`);
      console.log(`  Status: ${commission.status}`);
      console.log('');
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

fixCommissionAmounts();