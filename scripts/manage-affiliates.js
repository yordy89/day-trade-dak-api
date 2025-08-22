const mongoose = require('mongoose');
const readline = require('readline');
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
  stripeCouponId: String,
  stripePromotionCodeId: String,
  createdAt: Date,
  updatedAt: Date,
});

const Affiliate = mongoose.model('Affiliate', affiliateSchema);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function createAffiliate() {
  console.log('\n=== CREATE NEW AFFILIATE ===\n');
  
  const affiliateCode = await question('Enter affiliate code (e.g., SELLER001): ');
  const name = await question('Enter seller name: ');
  const email = await question('Enter seller email: ');
  const phoneNumber = await question('Enter phone number (optional, press Enter to skip): ');
  const discountPercentage = await question('Enter discount percentage (e.g., 15 for 15%): ');
  const commissionRate = await question('Enter commission rate (e.g., 5 for 5%): ');

  const newAffiliate = new Affiliate({
    affiliateCode: affiliateCode.toUpperCase(),
    name,
    email: email.toLowerCase(),
    phoneNumber: phoneNumber || undefined,
    discountPercentage: parseFloat(discountPercentage),
    commissionRate: parseFloat(commissionRate),
    isActive: true,
    totalSales: 0,
    totalCommission: 0,
    totalRevenue: 0,
  });

  try {
    const saved = await newAffiliate.save();
    console.log('\n✅ Affiliate created successfully!');
    console.log('\n📋 AFFILIATE DETAILS:');
    console.log('========================');
    console.log(`Code: ${saved.affiliateCode}`);
    console.log(`Name: ${saved.name}`);
    console.log(`Email: ${saved.email}`);
    console.log(`Discount: ${saved.discountPercentage}%`);
    console.log(`Commission: ${saved.commissionRate}%`);
    console.log('========================\n');
    
    console.log('🎯 HOW IT WORKS:');
    console.log(`1. Share this code with the seller: ${saved.affiliateCode}`);
    console.log(`2. Customers enter "${saved.affiliateCode}" when registering for Master Course`);
    console.log(`3. They get ${saved.discountPercentage}% off automatically`);
    console.log(`4. Seller earns ${saved.commissionRate}% commission on each sale\n`);
    
    // Calculate example
    const originalPrice = 2999.99;
    const discountAmount = (originalPrice * saved.discountPercentage) / 100;
    const finalPrice = originalPrice - discountAmount;
    const commission = (finalPrice * saved.commissionRate) / 100;
    
    console.log('💰 EXAMPLE CALCULATION:');
    console.log(`Original Price: $${originalPrice}`);
    console.log(`Customer Discount: -$${discountAmount.toFixed(2)} (${saved.discountPercentage}%)`);
    console.log(`Customer Pays: $${finalPrice.toFixed(2)}`);
    console.log(`Seller Commission: $${commission.toFixed(2)} (${saved.commissionRate}% of final price)`);
    
  } catch (error) {
    if (error.code === 11000) {
      console.error('\n❌ Error: This affiliate code or email already exists!');
    } else {
      console.error('\n❌ Error creating affiliate:', error.message);
    }
  }
}

async function listAffiliates() {
  console.log('\n=== ALL AFFILIATES ===\n');
  
  const affiliates = await Affiliate.find().sort({ createdAt: -1 });
  
  if (affiliates.length === 0) {
    console.log('No affiliates found.');
    return;
  }
  
  console.log('Code         | Name                | Email                        | Discount | Commission | Sales | Revenue     | Status');
  console.log('-------------|--------------------|-----------------------------|----------|------------|-------|-------------|--------');
  
  affiliates.forEach(a => {
    const status = a.isActive ? '✅ Active' : '❌ Inactive';
    console.log(
      `${a.affiliateCode.padEnd(12)} | ${a.name.padEnd(19)} | ${a.email.padEnd(28)} | ${(a.discountPercentage + '%').padEnd(8)} | ${(a.commissionRate + '%').padEnd(10)} | ${a.totalSales.toString().padEnd(5)} | $${a.totalRevenue.toFixed(2).padEnd(10)} | ${status}`
    );
  });
  
  console.log(`\nTotal affiliates: ${affiliates.length}`);
}

async function viewAffiliateStats() {
  const code = await question('\nEnter affiliate code to view stats: ');
  
  const affiliate = await Affiliate.findOne({ 
    affiliateCode: code.toUpperCase() 
  });
  
  if (!affiliate) {
    console.log('❌ Affiliate not found!');
    return;
  }
  
  console.log('\n📊 AFFILIATE STATISTICS');
  console.log('========================');
  console.log(`Code: ${affiliate.affiliateCode}`);
  console.log(`Name: ${affiliate.name}`);
  console.log(`Email: ${affiliate.email}`);
  console.log(`Status: ${affiliate.isActive ? '✅ Active' : '❌ Inactive'}`);
  console.log('\nDISCOUNT & COMMISSION:');
  console.log(`Customer Discount: ${affiliate.discountPercentage}%`);
  console.log(`Seller Commission: ${affiliate.commissionRate}%`);
  console.log('\nPERFORMANCE:');
  console.log(`Total Sales: ${affiliate.totalSales}`);
  console.log(`Total Revenue: $${affiliate.totalRevenue.toFixed(2)}`);
  console.log(`Total Commission Earned: $${affiliate.totalCommission.toFixed(2)}`);
  console.log(`Average Sale Value: $${affiliate.totalSales > 0 ? (affiliate.totalRevenue / affiliate.totalSales).toFixed(2) : '0.00'}`);
  console.log('========================\n');
}

async function toggleAffiliateStatus() {
  const code = await question('\nEnter affiliate code to toggle status: ');
  
  const affiliate = await Affiliate.findOne({ 
    affiliateCode: code.toUpperCase() 
  });
  
  if (!affiliate) {
    console.log('❌ Affiliate not found!');
    return;
  }
  
  affiliate.isActive = !affiliate.isActive;
  await affiliate.save();
  
  console.log(`\n✅ Affiliate ${affiliate.affiliateCode} is now ${affiliate.isActive ? 'ACTIVE' : 'INACTIVE'}`);
}

async function updateAffiliate() {
  const code = await question('\nEnter affiliate code to update: ');
  
  const affiliate = await Affiliate.findOne({ 
    affiliateCode: code.toUpperCase() 
  });
  
  if (!affiliate) {
    console.log('❌ Affiliate not found!');
    return;
  }
  
  console.log(`\nCurrent values for ${affiliate.affiliateCode}:`);
  console.log(`Discount: ${affiliate.discountPercentage}%`);
  console.log(`Commission: ${affiliate.commissionRate}%`);
  
  const newDiscount = await question('\nEnter new discount % (or press Enter to keep current): ');
  const newCommission = await question('Enter new commission % (or press Enter to keep current): ');
  
  if (newDiscount) {
    affiliate.discountPercentage = parseFloat(newDiscount);
  }
  if (newCommission) {
    affiliate.commissionRate = parseFloat(newCommission);
  }
  
  await affiliate.save();
  
  console.log('\n✅ Affiliate updated successfully!');
  console.log(`New Discount: ${affiliate.discountPercentage}%`);
  console.log(`New Commission: ${affiliate.commissionRate}%`);
}

async function main() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('\n🔌 Connected to MongoDB\n');
    
    let running = true;
    
    while (running) {
      console.log('\n========== AFFILIATE MANAGEMENT ==========');
      console.log('1. Create new affiliate');
      console.log('2. List all affiliates');
      console.log('3. View affiliate statistics');
      console.log('4. Toggle affiliate status (activate/deactivate)');
      console.log('5. Update affiliate rates');
      console.log('6. Exit');
      console.log('==========================================');
      
      const choice = await question('\nSelect an option (1-6): ');
      
      switch(choice) {
        case '1':
          await createAffiliate();
          break;
        case '2':
          await listAffiliates();
          break;
        case '3':
          await viewAffiliateStats();
          break;
        case '4':
          await toggleAffiliateStatus();
          break;
        case '5':
          await updateAffiliate();
          break;
        case '6':
          running = false;
          break;
        default:
          console.log('Invalid option. Please try again.');
      }
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    rl.close();
    await mongoose.disconnect();
    console.log('\n👋 Goodbye!\n');
    process.exit(0);
  }
}

main();