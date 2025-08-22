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
});

const Affiliate = mongoose.model('Affiliate', affiliateSchema);

async function addAffiliate() {
  // Get arguments from command line
  const args = process.argv.slice(2);
  
  if (args.length < 6) {
    console.log('❌ Usage:');
    console.log('  node add-affiliate.js <CODE> <NAME> <EMAIL> <DISCOUNT_TYPE> <DISCOUNT_VALUE> <COMMISSION_TYPE> <COMMISSION_VALUE> [PHONE]');
    console.log('\nExamples:');
    console.log('  % discount, % commission:');
    console.log('    node add-affiliate.js MARIA2024 "Maria Garcia" maria@email.com percentage 15 percentage 5');
    console.log('  Fixed discount, fixed commission:');
    console.log('    node add-affiliate.js JOHN2024 "John Doe" john@email.com fixed 500 fixed 150');
    console.log('  Mixed (% discount, fixed commission):');
    console.log('    node add-affiliate.js JANE2024 "Jane Smith" jane@email.com percentage 20 fixed 200');
    process.exit(1);
  }
  
  const [code, name, email, discountType, discountValue, commissionType, commissionValue, phone] = args;
  
  // Validate discount type
  if (discountType !== 'percentage' && discountType !== 'fixed') {
    console.log('❌ Error: Discount type must be "percentage" or "fixed"');
    process.exit(1);
  }
  
  // Validate commission type
  if (commissionType !== 'percentage' && commissionType !== 'fixed') {
    console.log('❌ Error: Commission type must be "percentage" or "fixed"');
    process.exit(1);
  }
  
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB\n');
    
    // Check if code or email already exists
    const existing = await Affiliate.findOne({
      $or: [
        { affiliateCode: code.toUpperCase() },
        { email: email.toLowerCase() }
      ]
    });
    
    if (existing) {
      console.log('❌ Error: This affiliate code or email already exists!');
      process.exit(1);
    }
    
    const affiliateData = {
      affiliateCode: code.toUpperCase(),
      name,
      email: email.toLowerCase(),
      phoneNumber: phone || undefined,
      discountType,
      commissionType,
      isActive: true,
      totalSales: 0,
      totalCommission: 0,
      totalRevenue: 0,
    };
    
    if (discountType === 'percentage') {
      affiliateData.discountPercentage = parseFloat(discountValue);
    } else {
      affiliateData.discountFixedAmount = parseFloat(discountValue);
    }
    
    if (commissionType === 'percentage') {
      affiliateData.commissionRate = parseFloat(commissionValue);
    } else {
      affiliateData.commissionFixedAmount = parseFloat(commissionValue);
    }
    
    const newAffiliate = new Affiliate(affiliateData);
    
    const saved = await newAffiliate.save();
    
    console.log('✅ AFFILIATE CREATED SUCCESSFULLY!\n');
    console.log('=====================================');
    console.log(`Referral Code: ${saved.affiliateCode}`);
    console.log(`Seller Name: ${saved.name}`);
    console.log(`Email: ${saved.email}`);
    console.log(`Phone: ${saved.phoneNumber || 'Not provided'}`);
    console.log(`Discount Type: ${saved.discountType}`);
    if (saved.discountType === 'percentage') {
      console.log(`Customer Discount: ${saved.discountPercentage}%`);
    } else {
      console.log(`Customer Discount: $${saved.discountFixedAmount}`);
    }
    console.log(`Commission Type: ${saved.commissionType}`);
    if (saved.commissionType === 'percentage') {
      console.log(`Seller Commission: ${saved.commissionRate}%`);
    } else {
      console.log(`Seller Commission: $${saved.commissionFixedAmount} per sale`);
    }
    console.log('=====================================\n');
    
    // Calculate example
    const originalPrice = 2999.99;
    let discountAmount = 0;
    if (saved.discountType === 'percentage') {
      discountAmount = (originalPrice * saved.discountPercentage) / 100;
    } else {
      discountAmount = Math.min(saved.discountFixedAmount, originalPrice);
    }
    const finalPrice = originalPrice - discountAmount;
    
    let commissionAmount = 0;
    if (saved.commissionType === 'percentage') {
      commissionAmount = (finalPrice * saved.commissionRate) / 100;
    } else {
      commissionAmount = saved.commissionFixedAmount;
    }
    
    console.log('💰 PRICING BREAKDOWN:');
    console.log(`Original Price: $${originalPrice}`);
    const discountLabel = saved.discountType === 'percentage' 
      ? `(${saved.discountPercentage}%)` 
      : '(Fixed)';
    console.log(`Customer Saves: $${discountAmount.toFixed(2)} ${discountLabel}`);
    console.log(`Customer Pays: $${finalPrice.toFixed(2)}`);
    console.log(`Seller Earns: $${commissionAmount.toFixed(2)} per sale\n`);
    
    console.log('📋 INSTRUCTIONS FOR SELLER:');
    console.log(`1. Share code "${saved.affiliateCode}" with customers`);
    console.log(`2. Customers enter it when registering for Master Course`);
    const savingsText = saved.discountType === 'percentage' 
      ? `${saved.discountPercentage}% instantly`
      : `$${saved.discountFixedAmount} instantly`;
    console.log(`3. They save ${savingsText}`);
    console.log(`4. You earn $${commissionAmount.toFixed(2)} for each sale\n`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

addAffiliate();