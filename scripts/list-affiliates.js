const mongoose = require('mongoose');
require('dotenv').config();

// Define the Affiliate schema
const affiliateSchema = new mongoose.Schema({
  affiliateCode: String,
  name: String,
  email: String,
  phoneNumber: String,
  discountPercentage: Number,
  commissionRate: Number,
  isActive: Boolean,
  totalSales: Number,
  totalCommission: Number,
  totalRevenue: Number,
  createdAt: Date,
  updatedAt: Date,
});

const Affiliate = mongoose.model('Affiliate', affiliateSchema);

async function listAffiliates() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB\n');
    
    const affiliates = await Affiliate.find().sort({ createdAt: -1 });
    
    console.log('=== CURRENT AFFILIATES IN SYSTEM ===\n');
    
    if (affiliates.length === 0) {
      console.log('No affiliates found.');
      return;
    }
    
    affiliates.forEach(a => {
      console.log(`📌 ${a.affiliateCode}`);
      console.log(`   Name: ${a.name}`);
      console.log(`   Email: ${a.email}`);
      console.log(`   Status: ${a.isActive ? '✅ Active' : '❌ Inactive'}`);
      console.log(`   Discount: ${a.discountPercentage}% off for customers`);
      console.log(`   Commission: ${a.commissionRate}% for seller`);
      console.log(`   Performance: ${a.totalSales} sales, $${a.totalRevenue.toFixed(2)} revenue`);
      console.log('   ---');
      
      // Calculate example
      const originalPrice = 2999.99;
      const discountAmount = (originalPrice * a.discountPercentage) / 100;
      const finalPrice = originalPrice - discountAmount;
      const commission = (finalPrice * a.commissionRate) / 100;
      
      console.log(`   Example: Customer pays $${finalPrice.toFixed(2)}, Seller earns $${commission.toFixed(2)}`);
      console.log('');
    });
    
    console.log(`\nTotal affiliates: ${affiliates.length}`);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
  }
}

listAffiliates();