const mongoose = require('mongoose');
require('dotenv').config();

// Define the Affiliate schema (matching the actual schema)
const affiliateSchema = new mongoose.Schema({
  affiliateCode: { type: String, required: true, unique: true, uppercase: true },
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  phoneNumber: { type: String },
  discountPercentage: { type: Number, default: 10, min: 0, max: 50 },
  commissionRate: { type: Number, default: 5, min: 0, max: 50 },
  isActive: { type: Boolean, default: true },
  totalSales: { type: Number, default: 0 },
  totalCommission: { type: Number, default: 0 },
  totalRevenue: { type: Number, default: 0 },
  metadata: { type: Object },
}, { timestamps: true });

const Affiliate = mongoose.model('Affiliate', affiliateSchema);

async function createTestAffiliate() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/daytradedak');
    console.log('Connected to MongoDB');

    // Check if test affiliate already exists
    const existing = await Affiliate.findOne({ affiliateCode: 'TEST123' });
    if (existing) {
      console.log('Test affiliate already exists:', existing);
      process.exit(0);
    }

    // Create test affiliate
    const testAffiliate = new Affiliate({
      affiliateCode: 'TEST123',
      name: 'Test Seller',
      email: 'test.seller@example.com',
      phoneNumber: '+1234567890',
      discountPercentage: 10, // 10% discount
      commissionRate: 5, // 5% commission
      isActive: true,
      metadata: {
        notes: 'Test affiliate for development',
        createdBy: 'script',
      },
    });

    const saved = await testAffiliate.save();
    console.log('Test affiliate created successfully:');
    console.log({
      affiliateCode: saved.affiliateCode,
      name: saved.name,
      email: saved.email,
      discountPercentage: saved.discountPercentage,
      commissionRate: saved.commissionRate,
    });

    // Create another test affiliate with higher discount
    const premiumAffiliate = new Affiliate({
      affiliateCode: 'PREMIUM20',
      name: 'Premium Seller',
      email: 'premium.seller@example.com',
      phoneNumber: '+1987654321',
      discountPercentage: 20, // 20% discount
      commissionRate: 8, // 8% commission
      isActive: true,
      metadata: {
        notes: 'Premium test affiliate with higher discount',
        createdBy: 'script',
      },
    });

    const savedPremium = await premiumAffiliate.save();
    console.log('\nPremium affiliate created successfully:');
    console.log({
      affiliateCode: savedPremium.affiliateCode,
      name: savedPremium.name,
      email: savedPremium.email,
      discountPercentage: savedPremium.discountPercentage,
      commissionRate: savedPremium.commissionRate,
    });

    console.log('\n✅ Test affiliates created successfully!');
    console.log('\nYou can now test with the following referral codes:');
    console.log('- TEST123 (10% discount)');
    console.log('- PREMIUM20 (20% discount)');
  } catch (error) {
    console.error('Error creating test affiliate:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
    process.exit(0);
  }
}

createTestAffiliate();