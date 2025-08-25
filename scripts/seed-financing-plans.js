const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/dtd-development', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const FinancingPlanSchema = new mongoose.Schema({
  planId: String,
  name: String,
  nameEN: String,
  description: String,
  descriptionEN: String,
  numberOfPayments: Number,
  frequency: String,
  isActive: Boolean,
  minAmount: Number,
  maxAmount: Number,
  downPaymentPercent: Number,
  processingFeePercent: Number,
  sortOrder: Number,
  autoCharge: Boolean,
  gracePeriodDays: Number,
  lateFeeAmount: Number,
  lateFeePercent: Number,
}, { timestamps: true });

const FinancingPlan = mongoose.model('FinancingPlan', FinancingPlanSchema);

const seedPlans = [
  {
    planId: '2_biweekly',
    name: '2 Pagos Quincenales',
    nameEN: '2 Biweekly Payments',
    description: 'Divide tu pago en 2 cuotas quincenales sin intereses',
    descriptionEN: 'Split your payment into 2 biweekly installments with no interest',
    numberOfPayments: 2,
    frequency: 'biweekly',
    isActive: true,
    minAmount: 100,
    maxAmount: 1000,
    downPaymentPercent: 0,
    processingFeePercent: 3, // 3% hidden fee
    sortOrder: 1,
    autoCharge: true,
    gracePeriodDays: 3,
    lateFeeAmount: 10,
    lateFeePercent: 0,
  },
  {
    planId: '4_biweekly',
    name: '4 Pagos Quincenales',
    nameEN: '4 Biweekly Payments',
    description: 'Divide tu pago en 4 cuotas quincenales sin intereses',
    descriptionEN: 'Split your payment into 4 biweekly installments with no interest',
    numberOfPayments: 4,
    frequency: 'biweekly',
    isActive: true,
    minAmount: 500,
    maxAmount: 5000,
    downPaymentPercent: 0,
    processingFeePercent: 5, // 5% hidden fee
    sortOrder: 2,
    autoCharge: true,
    gracePeriodDays: 3,
    lateFeeAmount: 15,
    lateFeePercent: 0,
  },
  {
    planId: '3_monthly',
    name: '3 Pagos Mensuales',
    nameEN: '3 Monthly Payments',
    description: 'Divide tu pago en 3 cuotas mensuales sin intereses',
    descriptionEN: 'Split your payment into 3 monthly installments with no interest',
    numberOfPayments: 3,
    frequency: 'monthly',
    isActive: true,
    minAmount: 300,
    maxAmount: 3000,
    downPaymentPercent: 0,
    processingFeePercent: 4, // 4% hidden fee
    sortOrder: 3,
    autoCharge: true,
    gracePeriodDays: 5,
    lateFeeAmount: 20,
    lateFeePercent: 0,
  },
  {
    planId: '6_monthly',
    name: '6 Pagos Mensuales',
    nameEN: '6 Monthly Payments',
    description: 'Divide tu pago en 6 cuotas mensuales sin intereses',
    descriptionEN: 'Split your payment into 6 monthly installments with no interest',
    numberOfPayments: 6,
    frequency: 'monthly',
    isActive: true,
    minAmount: 1000,
    maxAmount: 10000,
    downPaymentPercent: 10, // Require 10% down payment for longer terms
    processingFeePercent: 6, // 6% hidden fee
    sortOrder: 4,
    autoCharge: true,
    gracePeriodDays: 5,
    lateFeeAmount: 25,
    lateFeePercent: 0,
  },
];

async function seedDatabase() {
  try {
    // Clear existing plans
    await FinancingPlan.deleteMany({});
    console.log('Cleared existing financing plans');

    // Insert new plans
    for (const plan of seedPlans) {
      await FinancingPlan.create(plan);
      console.log(`Created plan: ${plan.name}`);
    }

    console.log('\n✅ Successfully seeded financing plans!');
    console.log(`Total plans created: ${seedPlans.length}`);
    
    process.exit(0);
  } catch (error) {
    console.error('Error seeding database:', error);
    process.exit(1);
  }
}

seedDatabase();