const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/daytradedak', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const subscriptionPlanSchema = new mongoose.Schema({
  planId: { type: String, required: true, unique: true },
  displayName: { type: String, required: true },
  displayNameES: { type: String },
  description: { type: String },
  descriptionES: { type: String },
  stripeProductId: { type: String },
  stripePriceId: { type: String },
  amount: { type: Number, required: true },
  currency: { type: String, default: 'usd' },
  interval: { type: String, enum: ['daily', 'weekly', 'monthly', 'yearly'], required: true },
  intervalCount: { type: Number, default: 1 },
  type: { type: String, enum: ['live', 'course', 'mentorship', 'bundle'] },
  features: [String],
  featuresES: [String],
  isActive: { type: Boolean, default: true },
  sortOrder: { type: Number, default: 0 },
  trialPeriodDays: { type: Number, default: 0 },
  metadata: { type: Map, of: String },
  limits: {
    maxUsers: { type: Number },
    maxStorage: { type: Number },
    maxApiCalls: { type: Number },
  },
  meetingPermissions: {
    canCreateMeetings: { type: Boolean, default: false },
    maxMeetingsPerMonth: { type: Number, default: 0 },
    maxMeetingDuration: { type: Number, default: 0 },
    maxParticipantsPerMeeting: { type: Number, default: 0 },
    canRecordMeetings: { type: Boolean, default: false },
    canScheduleMeetings: { type: Boolean, default: false },
    hasLiveMeetingAccess: { type: Boolean, default: false },
  },
}, {
  timestamps: true,
});

const SubscriptionPlan = mongoose.model('SubscriptionPlan', subscriptionPlanSchema, 'subscription_plans');

const defaultPlans = [
  {
    planId: 'LiveWeeklyManual',
    displayName: 'Live Trading Weekly Manual',
    displayNameES: 'Trading en Vivo Semanal Manual',
    description: 'Weekly access to live trading sessions with manual renewal',
    descriptionES: 'Acceso semanal a sesiones de trading en vivo con renovación manual',
    stripeProductId: 'prod_live_weekly_manual',
    stripePriceId: 'price_live_weekly_manual',
    amount: 2500, // $25
    currency: 'usd',
    interval: 'weekly',
    intervalCount: 1,
    type: 'live',
    features: ['Live trading access', 'Chat participation', 'Basic support'],
    featuresES: ['Acceso a trading en vivo', 'Participación en chat', 'Soporte básico'],
    sortOrder: 1,
    meetingPermissions: {
      canCreateMeetings: false,
      maxMeetingsPerMonth: 0,
      maxMeetingDuration: 0,
      maxParticipantsPerMeeting: 0,
      canRecordMeetings: false,
      canScheduleMeetings: false,
      hasLiveMeetingAccess: true,
    },
  },
  {
    planId: 'LiveWeeklyRecurring',
    displayName: 'Live Trading Weekly Recurring',
    displayNameES: 'Trading en Vivo Semanal Recurrente',
    description: 'Weekly access to live trading sessions with automatic renewal',
    descriptionES: 'Acceso semanal a sesiones de trading en vivo con renovación automática',
    stripeProductId: 'prod_live_weekly_recurring',
    stripePriceId: 'price_live_weekly_recurring',
    amount: 2000, // $20
    currency: 'usd',
    interval: 'weekly',
    intervalCount: 1,
    type: 'live',
    features: ['Live trading access', 'Chat participation', 'Basic support', 'Auto-renewal discount'],
    featuresES: ['Acceso a trading en vivo', 'Participación en chat', 'Soporte básico', 'Descuento por renovación automática'],
    sortOrder: 2,
    meetingPermissions: {
      canCreateMeetings: false,
      maxMeetingsPerMonth: 0,
      maxMeetingDuration: 0,
      maxParticipantsPerMeeting: 0,
      canRecordMeetings: false,
      canScheduleMeetings: false,
      hasLiveMeetingAccess: true,
    },
  },
  {
    planId: 'LiveMonthly',
    displayName: 'Live Trading Monthly',
    displayNameES: 'Trading en Vivo Mensual',
    description: 'Monthly access to all live trading sessions',
    descriptionES: 'Acceso mensual a todas las sesiones de trading en vivo',
    stripeProductId: 'prod_live_monthly',
    stripePriceId: 'price_live_monthly',
    amount: 7900, // $79
    currency: 'usd',
    interval: 'monthly',
    intervalCount: 1,
    type: 'live',
    features: ['Unlimited live trading access', 'Chat participation', 'Priority support', 'Recording access'],
    featuresES: ['Acceso ilimitado a trading en vivo', 'Participación en chat', 'Soporte prioritario', 'Acceso a grabaciones'],
    sortOrder: 3,
    meetingPermissions: {
      canCreateMeetings: false,
      maxMeetingsPerMonth: 0,
      maxMeetingDuration: 0,
      maxParticipantsPerMeeting: 0,
      canRecordMeetings: false,
      canScheduleMeetings: false,
      hasLiveMeetingAccess: true,
    },
  },
  {
    planId: 'MasterClasses',
    displayName: 'Master Classes',
    displayNameES: 'Clases Magistrales',
    description: 'Monthly access to master classes and advanced trading strategies',
    descriptionES: 'Acceso mensual a clases magistrales y estrategias avanzadas de trading',
    stripeProductId: 'prod_master_classes',
    stripePriceId: 'price_master_classes',
    amount: 9900, // $99
    currency: 'usd',
    interval: 'monthly',
    intervalCount: 1,
    type: 'course',
    features: ['Master class access', 'Advanced strategies', 'Priority support', 'Recordings access', 'Exclusive content'],
    featuresES: ['Acceso a clases magistrales', 'Estrategias avanzadas', 'Soporte prioritario', 'Acceso a grabaciones', 'Contenido exclusivo'],
    sortOrder: 4,
    meetingPermissions: {
      canCreateMeetings: false,
      maxMeetingsPerMonth: 0,
      maxMeetingDuration: 0,
      maxParticipantsPerMeeting: 0,
      canRecordMeetings: false,
      canScheduleMeetings: false,
      hasLiveMeetingAccess: true,
    },
  },
  {
    planId: 'EliteMentorship',
    displayName: 'Elite Mentorship',
    displayNameES: 'Mentoría Elite',
    description: 'One-on-one mentorship with expert traders',
    descriptionES: 'Mentoría personalizada con traders expertos',
    stripeProductId: 'prod_elite_mentorship',
    stripePriceId: 'price_elite_mentorship',
    amount: 49900, // $499
    currency: 'usd',
    interval: 'monthly',
    intervalCount: 1,
    type: 'mentorship',
    features: ['Personal mentorship', 'Weekly 1-on-1 sessions', 'Custom trading plan', 'Direct support', 'All courses included'],
    featuresES: ['Mentoría personal', 'Sesiones 1-a-1 semanales', 'Plan de trading personalizado', 'Soporte directo', 'Todos los cursos incluidos'],
    sortOrder: 5,
    meetingPermissions: {
      canCreateMeetings: true,
      maxMeetingsPerMonth: 4,
      maxMeetingDuration: 120,
      maxParticipantsPerMeeting: 2,
      canRecordMeetings: true,
      canScheduleMeetings: true,
      hasLiveMeetingAccess: true,
    },
  },
];

async function initializeSubscriptionPlans() {
  try {
    console.log('Starting subscription plan initialization...');
    
    for (const planData of defaultPlans) {
      const existingPlan = await SubscriptionPlan.findOne({ planId: planData.planId });
      
      if (existingPlan) {
        // Update existing plan
        Object.assign(existingPlan, planData);
        await existingPlan.save();
        console.log(`Updated plan: ${planData.displayName}`);
      } else {
        // Create new plan
        const newPlan = new SubscriptionPlan(planData);
        await newPlan.save();
        console.log(`Created plan: ${planData.displayName}`);
      }
    }
    
    console.log('Subscription plan initialization completed successfully!');
    
    // List all plans
    const allPlans = await SubscriptionPlan.find({}).sort({ sortOrder: 1 });
    console.log('\nAll subscription plans:');
    allPlans.forEach(plan => {
      console.log(`- ${plan.displayName} (${plan.planId}): $${plan.amount/100} ${plan.currency.toUpperCase()}`);
    });
    
  } catch (error) {
    console.error('Error initializing subscription plans:', error);
  } finally {
    await mongoose.disconnect();
  }
}

// Run the initialization
initializeSubscriptionPlans();