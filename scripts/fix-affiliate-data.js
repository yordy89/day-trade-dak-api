const mongoose = require('mongoose');
require('dotenv').config();

// Define the Affiliate schema
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

const Affiliate = mongoose.model('Affiliate', affiliateSchema);

async function fixAffiliateData() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB\n');
    
    // Find all affiliates
    const affiliates = await Affiliate.find();
    console.log(`Found ${affiliates.length} affiliates to check\n`);
    
    for (const affiliate of affiliates) {
      let needsUpdate = false;
      const updates = {};
      const unsetFields = {};
      
      // Check discount type and clean up unnecessary fields
      if (affiliate.discountType === 'fixed') {
        if (affiliate.discountPercentage !== undefined) {
          console.log(`${affiliate.affiliateCode}: Removing unnecessary discountPercentage field`);
          unsetFields.discountPercentage = 1;
          needsUpdate = true;
        }
      } else if (affiliate.discountType === 'percentage') {
        if (affiliate.discountFixedAmount !== undefined) {
          console.log(`${affiliate.affiliateCode}: Removing unnecessary discountFixedAmount field`);
          unsetFields.discountFixedAmount = 1;
          needsUpdate = true;
        }
      }
      
      // Check commission type and clean up unnecessary fields
      if (affiliate.commissionType === 'fixed') {
        if (affiliate.commissionRate !== undefined) {
          console.log(`${affiliate.affiliateCode}: Removing unnecessary commissionRate field`);
          unsetFields.commissionRate = 1;
          needsUpdate = true;
        }
      } else if (affiliate.commissionType === 'percentage') {
        if (affiliate.commissionFixedAmount !== undefined) {
          console.log(`${affiliate.affiliateCode}: Removing unnecessary commissionFixedAmount field`);
          unsetFields.commissionFixedAmount = 1;
          needsUpdate = true;
        }
      }
      
      // Apply updates if needed
      if (needsUpdate) {
        const updateQuery = {};
        if (Object.keys(unsetFields).length > 0) {
          updateQuery.$unset = unsetFields;
        }
        if (Object.keys(updates).length > 0) {
          updateQuery.$set = updates;
        }
        
        await Affiliate.findByIdAndUpdate(affiliate._id, updateQuery);
        console.log(`✅ Fixed ${affiliate.affiliateCode}\n`);
      } else {
        console.log(`✓ ${affiliate.affiliateCode} is already correct\n`);
      }
    }
    
    console.log('\n=== VERIFICATION ===\n');
    
    // Verify the fix
    const fixedAffiliates = await Affiliate.find();
    for (const affiliate of fixedAffiliates) {
      console.log(`${affiliate.affiliateCode}:`);
      console.log(`  Discount: ${affiliate.discountType === 'percentage' 
        ? `${affiliate.discountPercentage}%` 
        : `$${affiliate.discountFixedAmount}`}`);
      console.log(`  Commission: ${affiliate.commissionType === 'percentage' 
        ? `${affiliate.commissionRate}%` 
        : `$${affiliate.commissionFixedAmount}`}`);
      console.log('');
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

fixAffiliateData();