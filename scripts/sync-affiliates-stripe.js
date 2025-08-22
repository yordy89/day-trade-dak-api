const mongoose = require('mongoose');
const Stripe = require('stripe');
require('dotenv').config();

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Define the Affiliate schema
const affiliateSchema = new mongoose.Schema({
  affiliateCode: String,
  name: String,
  email: String,
  discountPercentage: Number,
  commissionRate: Number,
  isActive: Boolean,
  stripeCouponId: String,
  stripePromotionCodeId: String,
});

const Affiliate = mongoose.model('Affiliate', affiliateSchema);

async function syncAffiliatesWithStripe() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    // Get all active affiliates without Stripe integration
    const affiliates = await Affiliate.find({ 
      isActive: true,
      stripeCouponId: { $exists: false }
    });

    console.log(`Found ${affiliates.length} affiliates to sync with Stripe\n`);

    for (const affiliate of affiliates) {
      try {
        console.log(`Processing affiliate: ${affiliate.affiliateCode}`);

        // Create a coupon in Stripe
        const coupon = await stripe.coupons.create({
          percent_off: affiliate.discountPercentage,
          duration: 'once',
          id: `AFFILIATE_${affiliate.affiliateCode}`,
          metadata: {
            affiliateCode: affiliate.affiliateCode,
            affiliateName: affiliate.name,
            type: 'affiliate_discount',
          },
        });

        console.log(`  ✓ Created coupon: ${coupon.id}`);

        // Create a promotion code that uses this coupon
        const promotionCode = await stripe.promotionCodes.create({
          coupon: coupon.id,
          code: affiliate.affiliateCode,
          metadata: {
            affiliateCode: affiliate.affiliateCode,
            affiliateName: affiliate.name,
          },
        });

        console.log(`  ✓ Created promotion code: ${promotionCode.code}`);

        // Update affiliate with Stripe IDs
        await Affiliate.findByIdAndUpdate(affiliate._id, {
          stripeCouponId: coupon.id,
          stripePromotionCodeId: promotionCode.id,
        });

        console.log(`  ✓ Updated affiliate record\n`);

      } catch (error) {
        console.error(`  ✗ Error processing ${affiliate.affiliateCode}:`, error.message);
        
        // Check if it's because the code already exists
        if (error.code === 'resource_already_exists') {
          console.log(`  → Coupon/code already exists in Stripe, updating record...`);
          
          try {
            // Try to retrieve existing coupon
            const existingCoupon = await stripe.coupons.retrieve(`AFFILIATE_${affiliate.affiliateCode}`);
            
            // Find the promotion code
            const promotionCodes = await stripe.promotionCodes.list({
              code: affiliate.affiliateCode,
              limit: 1
            });

            if (promotionCodes.data.length > 0) {
              // Update affiliate with existing Stripe IDs
              await Affiliate.findByIdAndUpdate(affiliate._id, {
                stripeCouponId: existingCoupon.id,
                stripePromotionCodeId: promotionCodes.data[0].id,
              });
              console.log(`  ✓ Linked to existing Stripe resources\n`);
            }
          } catch (retrieveError) {
            console.error(`  ✗ Could not retrieve existing resources:`, retrieveError.message);
          }
        }
      }
    }

    console.log('✅ Stripe sync complete!');

    // Show summary
    const syncedAffiliates = await Affiliate.find({ 
      stripeCouponId: { $exists: true, $ne: null }
    });

    console.log(`\nSummary:`);
    console.log(`- Total affiliates in database: ${await Affiliate.countDocuments()}`);
    console.log(`- Synced with Stripe: ${syncedAffiliates.length}`);
    console.log(`\nSynced affiliates:`);
    
    for (const affiliate of syncedAffiliates) {
      console.log(`  - ${affiliate.affiliateCode}: ${affiliate.discountPercentage}% discount`);
    }

  } catch (error) {
    console.error('Error syncing affiliates:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
  }
}

syncAffiliatesWithStripe();