import { MongoClient } from 'mongodb';
import * as dotenv from 'dotenv';
import { PlanInterval, PlanType } from '../subscriptions/subscription-plan.schema';

// Load environment variables
dotenv.config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/daytradedak';

// Complete subscription plan data with all fields
const SUBSCRIPTION_PLANS = [
  // Community Subscriptions (Weekly)
  {
    planId: 'LiveWeeklyManual',
    displayName: {
      en: 'Live Trading Weekly',
      es: 'Trading en Vivo Semanal'
    },
    description: {
      en: 'Access daily live trading sessions for 7 days with manual renewal',
      es: 'Acceso a sesiones diarias de trading en vivo por 7 días con renovación manual'
    },
    stripeIds: {
      development: {
        productId: 'prod_RNkRQtYPxxWKDI',
        priceId: 'price_1Rj37aJ1acFkbhNI6psETNkH'
      },
      production: {
        productId: 'prod_PROD_LIVE_WEEKLY_MANUAL', // TODO: Update with production ID
        priceId: 'price_PROD_LIVE_WEEKLY_MANUAL' // TODO: Update with production ID
      }
    },
    pricing: {
      baseAmount: 53.99, // $53.99
      currency: 'usd',
      interval: PlanInterval.WEEKLY,
      intervalCount: 1
    },
    type: PlanType.LIVE,
    features: {
      en: [
        'Daily live trading sessions',
        'Real-time market analysis',
        'Q&A with professional traders',
        'Trading signals',
        'Manual renewal required'
      ],
      es: [
        'Sesiones diarias de trading en vivo',
        'Análisis de mercado en tiempo real',
        'Preguntas y respuestas con traders profesionales',
        'Señales de trading',
        'Renovación manual requerida'
      ]
    },
    conditionalPricing: [],
    meetingPermissions: {
      canCreateMeetings: false,
      maxMeetingsPerMonth: 0,
      maxMeetingDuration: 0,
      maxParticipantsPerMeeting: 0,
      canRecordMeetings: false,
      canScheduleMeetings: false,
      hasLiveMeetingAccess: true
    },
    uiMetadata: {
      color: '#ef4444',
      icon: 'LiveTv',
      popular: false,
      sortOrder: 1
    },
    isActive: true,
    includedCourses: [],
    trialPeriodDays: 0,
    allowPromotionCodes: true
  },
  {
    planId: 'LiveWeeklyRecurring',
    displayName: {
      en: 'Live Trading Auto-Renew',
      es: 'Trading en Vivo Auto-Renovable'
    },
    description: {
      en: 'Continuous access to daily live trading sessions with automatic renewal',
      es: 'Acceso continuo a sesiones diarias de trading en vivo con renovación automática'
    },
    stripeIds: {
      development: {
        productId: 'prod_RNkWMGrKS5JZXN',
        priceId: 'price_1Rj383J1acFkbhNIO3TfFmnl'
      },
      production: {
        productId: 'prod_PROD_LIVE_WEEKLY_RECURRING', // TODO: Update with production ID
        priceId: 'price_PROD_LIVE_WEEKLY_RECURRING' // TODO: Update with production ID
      }
    },
    pricing: {
      baseAmount: 53.99, // $53.99
      currency: 'usd',
      interval: PlanInterval.WEEKLY,
      intervalCount: 1
    },
    type: PlanType.LIVE,
    features: {
      en: [
        'All Live Trading features',
        'Auto-renews every week',
        'Never miss a session',
        'Cancel anytime',
        'Priority support'
      ],
      es: [
        'Todas las características de Trading en Vivo',
        'Se renueva automáticamente cada semana',
        'Nunca te pierdas una sesión',
        'Cancela en cualquier momento',
        'Soporte prioritario'
      ]
    },
    conditionalPricing: [],
    meetingPermissions: {
      canCreateMeetings: false,
      maxMeetingsPerMonth: 0,
      maxMeetingDuration: 0,
      maxParticipantsPerMeeting: 0,
      canRecordMeetings: false,
      canScheduleMeetings: false,
      hasLiveMeetingAccess: true
    },
    uiMetadata: {
      color: '#f59e0b',
      icon: 'Loop',
      badge: 'BEST VALUE',
      popular: true,
      sortOrder: 2
    },
    isActive: true,
    includedCourses: [],
    trialPeriodDays: 0,
    allowPromotionCodes: true
  },

  // Recurring Monthly Subscriptions
  {
    planId: 'MasterClases',
    displayName: {
      en: 'Master Classes',
      es: 'Clases Magistrales'
    },
    description: {
      en: 'Comprehensive trading education with weekly mentoring and advanced strategies',
      es: 'Educación integral de trading con mentoría semanal y estrategias avanzadas'
    },
    stripeIds: {
      development: {
        productId: 'prod_RNoYe5hhXJhxDx',
        priceId: 'price_1Rk7OOJ1acFkbhNI1JAr62Lw'
      },
      production: {
        productId: 'prod_PROD_MASTER_CLASES', // TODO: Update with production ID
        priceId: 'price_PROD_MASTER_CLASES' // TODO: Update with production ID
      }
    },
    pricing: {
      baseAmount: 199.99, // $199.99
      currency: 'usd',
      interval: PlanInterval.MONTHLY,
      intervalCount: 1
    },
    type: PlanType.COURSE,
    features: {
      en: [
        'All trading courses',
        'Weekly group mentoring',
        'Trading strategies library',
        'Market analysis tools',
        'Community access'
      ],
      es: [
        'Todos los cursos de trading',
        'Mentoría grupal semanal',
        'Biblioteca de estrategias de trading',
        'Herramientas de análisis de mercado',
        'Acceso a la comunidad'
      ]
    },
    conditionalPricing: [
      {
        type: 'discount',
        requiredPlans: ['LiveWeeklyManual', 'LiveWeeklyRecurring'],
        discountAmount: 177, // $177 discount
        discountReason: '$177 off with Live subscription'
      }
    ],
    meetingPermissions: {
      canCreateMeetings: false,
      maxMeetingsPerMonth: 0,
      maxMeetingDuration: 0,
      maxParticipantsPerMeeting: 0,
      canRecordMeetings: false,
      canScheduleMeetings: false,
      hasLiveMeetingAccess: true
    },
    uiMetadata: {
      color: '#8b5cf6',
      icon: 'School',
      popular: false,
      sortOrder: 3
    },
    isActive: true,
    includedCourses: [],
    trialPeriodDays: 0,
    allowPromotionCodes: true
  },
  {
    planId: 'LiveRecorded',
    displayName: {
      en: 'Recorded Classes',
      es: 'Clases Grabadas'
    },
    description: {
      en: 'Access to all recorded trading classes and new content weekly',
      es: 'Acceso a todas las clases de trading grabadas y nuevo contenido semanal'
    },
    stripeIds: {
      development: {
        productId: 'prod_RNoaJkoyEOlXl0',
        priceId: 'price_1Rk7PoJ1acFkbhNInNuVejrp'
      },
      production: {
        productId: 'prod_PROD_LIVE_RECORDED', // TODO: Update with production ID
        priceId: 'price_PROD_LIVE_RECORDED' // TODO: Update with production ID
      }
    },
    pricing: {
      baseAmount: 52.99, // $52.99
      currency: 'usd',
      interval: PlanInterval.MONTHLY,
      intervalCount: 1
    },
    type: PlanType.COURSE,
    features: {
      en: [
        'All recorded classes',
        'New classes added weekly',
        'Download for offline viewing',
        'Class notes and materials',
        'Free with Live subscription!'
      ],
      es: [
        'Todas las clases grabadas',
        'Nuevas clases añadidas semanalmente',
        'Descarga para ver sin conexión',
        'Notas y materiales de clase',
        '¡Gratis con suscripción Live!'
      ]
    },
    conditionalPricing: [
      {
        type: 'free',
        requiredPlans: ['LiveWeeklyManual', 'LiveWeeklyRecurring'],
        discountReason: 'Free with Live subscription'
      }
    ],
    meetingPermissions: {
      canCreateMeetings: false,
      maxMeetingsPerMonth: 0,
      maxMeetingDuration: 0,
      maxParticipantsPerMeeting: 0,
      canRecordMeetings: false,
      canScheduleMeetings: false,
      hasLiveMeetingAccess: false
    },
    uiMetadata: {
      color: '#3b82f6',
      icon: 'VideoLibrary',
      popular: false,
      sortOrder: 4
    },
    isActive: true,
    includedCourses: [],
    trialPeriodDays: 0,
    allowPromotionCodes: true
  },
  {
    planId: 'Psicotrading',
    displayName: {
      en: 'Trading Psychology',
      es: 'Psicología del Trading'
    },
    description: {
      en: 'Master your emotions and mindset for consistent trading success',
      es: 'Domina tus emociones y mentalidad para el éxito consistente en el trading'
    },
    stripeIds: {
      development: {
        productId: 'prod_RNIQ6SJmLiP9Sd',
        priceId: 'price_1RNIS6J1acFkbhNIyPeQVOAS'
      },
      production: {
        productId: 'prod_PROD_PSICOTRADING', // TODO: Update with production ID
        priceId: 'price_PROD_PSICOTRADING' // TODO: Update with production ID
      }
    },
    pricing: {
      baseAmount: 29.99, // $29.99
      currency: 'usd',
      interval: PlanInterval.MONTHLY,
      intervalCount: 1
    },
    type: PlanType.COURSE,
    features: {
      en: [
        'Psychology workshops',
        'Emotional control techniques',
        'Mindfulness for traders',
        'Stress management',
        'Performance coaching'
      ],
      es: [
        'Talleres de psicología',
        'Técnicas de control emocional',
        'Mindfulness para traders',
        'Manejo del estrés',
        'Coaching de rendimiento'
      ]
    },
    conditionalPricing: [],
    meetingPermissions: {
      canCreateMeetings: false,
      maxMeetingsPerMonth: 0,
      maxMeetingDuration: 0,
      maxParticipantsPerMeeting: 0,
      canRecordMeetings: false,
      canScheduleMeetings: false,
      hasLiveMeetingAccess: false
    },
    uiMetadata: {
      color: '#06b6d4',
      icon: 'Psychology',
      popular: false,
      sortOrder: 5
    },
    isActive: true,
    includedCourses: [],
    trialPeriodDays: 0,
    allowPromotionCodes: true
  },

  // One-Time Purchases
  {
    planId: 'Classes',
    displayName: {
      en: 'Complete Trading Course',
      es: 'Curso Completo de Trading'
    },
    description: {
      en: 'Comprehensive trading education package with lifetime access',
      es: 'Paquete completo de educación en trading con acceso de por vida'
    },
    stripeIds: {
      development: {
        productId: 'prod_RNnfMCjRsqJaAX',
        priceId: 'price_1Rk6VVJ1acFkbhNIGFGK4mzA'
      },
      production: {
        productId: 'prod_PROD_CLASSES', // TODO: Update with production ID
        priceId: 'price_PROD_CLASSES' // TODO: Update with production ID
      }
    },
    pricing: {
      baseAmount: 500.00, // $500.00
      currency: 'usd',
      interval: PlanInterval.ONCE,
      intervalCount: 1
    },
    type: PlanType.COURSE,
    features: {
      en: [
        'Complete trading curriculum',
        'Lifetime access',
        'All course materials',
        'Certificate of completion',
        'Community forum access'
      ],
      es: [
        'Currículum completo de trading',
        'Acceso de por vida',
        'Todos los materiales del curso',
        'Certificado de finalización',
        'Acceso al foro de la comunidad'
      ]
    },
    conditionalPricing: [],
    meetingPermissions: {
      canCreateMeetings: false,
      maxMeetingsPerMonth: 0,
      maxMeetingDuration: 0,
      maxParticipantsPerMeeting: 0,
      canRecordMeetings: false,
      canScheduleMeetings: false,
      hasLiveMeetingAccess: false
    },
    uiMetadata: {
      color: '#10b981',
      icon: 'MenuBook',
      popular: false,
      sortOrder: 6
    },
    isActive: true,
    includedCourses: [],
    trialPeriodDays: 0,
    allowPromotionCodes: true
  },
  {
    planId: 'PeaceWithMoney',
    displayName: {
      en: 'Peace with Money',
      es: 'Paz con el Dinero'
    },
    description: {
      en: '60-day transformational program to heal your relationship with money',
      es: 'Programa transformacional de 60 días para sanar tu relación con el dinero'
    },
    stripeIds: {
      development: {
        productId: 'prod_RX2i27dCeYMoOU',
        priceId: 'price_1RX2hDJ1acFkbhNIq4mDa1Js'
      },
      production: {
        productId: 'prod_PROD_PEACE_WITH_MONEY', // TODO: Update with production ID
        priceId: 'price_PROD_PEACE_WITH_MONEY' // TODO: Update with production ID
      }
    },
    pricing: {
      baseAmount: 199.99, // $199.99
      currency: 'usd',
      interval: PlanInterval.ONCE,
      intervalCount: 1
    },
    type: PlanType.COURSE,
    features: {
      en: [
        'Complete financial mindset course',
        'Daily exercises and meditations',
        'Money relationship healing',
        'Abundance mindset training',
        '60-day access'
      ],
      es: [
        'Curso completo de mentalidad financiera',
        'Ejercicios diarios y meditaciones',
        'Sanación de la relación con el dinero',
        'Entrenamiento de mentalidad de abundancia',
        'Acceso por 60 días'
      ]
    },
    conditionalPricing: [],
    meetingPermissions: {
      canCreateMeetings: false,
      maxMeetingsPerMonth: 0,
      maxMeetingDuration: 0,
      maxParticipantsPerMeeting: 0,
      canRecordMeetings: false,
      canScheduleMeetings: false,
      hasLiveMeetingAccess: false
    },
    uiMetadata: {
      color: '#16a34a',
      icon: 'MoneyOff',
      popular: false,
      sortOrder: 7
    },
    isActive: true,
    includedCourses: [],
    trialPeriodDays: 0,
    allowPromotionCodes: true
  },
  {
    planId: 'MasterCourse',
    displayName: {
      en: 'Master Trading Course',
      es: 'Curso Maestro de Trading'
    },
    description: {
      en: 'Professional trading program with lifetime access and certification',
      es: 'Programa profesional de trading con acceso de por vida y certificación'
    },
    stripeIds: {
      development: {
        productId: 'prod_RNkXGC0jmnZSJC',
        priceId: 'price_1Rj38bJ1acFkbhNID7qBD4lz'
      },
      production: {
        productId: 'prod_PROD_MASTER_COURSE', // TODO: Update with production ID
        priceId: 'price_PROD_MASTER_COURSE' // TODO: Update with production ID
      }
    },
    pricing: {
      baseAmount: 2999.99, // $2999.99
      currency: 'usd',
      interval: PlanInterval.ONCE,
      intervalCount: 1
    },
    type: PlanType.COURSE,
    features: {
      en: [
        'Lifetime access',
        'Professional strategies',
        'Live trading labs',
        'Certificate of completion',
        'BNPL options available'
      ],
      es: [
        'Acceso de por vida',
        'Estrategias profesionales',
        'Laboratorios de trading en vivo',
        'Certificado de finalización',
        'Opciones de pago a plazos disponibles'
      ]
    },
    conditionalPricing: [],
    meetingPermissions: {
      canCreateMeetings: false,
      maxMeetingsPerMonth: 0,
      maxMeetingDuration: 0,
      maxParticipantsPerMeeting: 0,
      canRecordMeetings: false,
      canScheduleMeetings: false,
      hasLiveMeetingAccess: true
    },
    uiMetadata: {
      color: '#7c3aed',
      icon: 'School',
      badge: 'NEW',
      popular: false,
      sortOrder: 8
    },
    isActive: true,
    includedCourses: [],
    trialPeriodDays: 0,
    allowPromotionCodes: true
  },

  // Event Subscriptions
  {
    planId: 'CommunityEvent',
    displayName: {
      en: 'Community Event',
      es: 'Evento Comunitario'
    },
    description: {
      en: 'Special community event for active members',
      es: 'Evento especial de la comunidad para miembros activos'
    },
    stripeIds: {
      development: {
        productId: 'prod_RNoPOgnLm1DK5r',
        priceId: 'price_1RjVpqJ1acFkbhNIGH06m1RA'
      },
      production: {
        productId: 'prod_PROD_COMMUNITY_EVENT', // TODO: Update with production ID
        priceId: 'price_PROD_COMMUNITY_EVENT' // TODO: Update with production ID
      }
    },
    pricing: {
      baseAmount: 599.99, // $599.99
      currency: 'usd',
      interval: PlanInterval.ONCE,
      intervalCount: 1
    },
    type: PlanType.EVENT,
    features: {
      en: [
        'Exclusive community event',
        'Networking opportunities',
        'Special guest speakers',
        'Q&A sessions',
        'Event materials'
      ],
      es: [
        'Evento exclusivo de la comunidad',
        'Oportunidades de networking',
        'Oradores invitados especiales',
        'Sesiones de preguntas y respuestas',
        'Materiales del evento'
      ]
    },
    conditionalPricing: [],
    meetingPermissions: {
      canCreateMeetings: false,
      maxMeetingsPerMonth: 0,
      maxMeetingDuration: 0,
      maxParticipantsPerMeeting: 0,
      canRecordMeetings: false,
      canScheduleMeetings: false,
      hasLiveMeetingAccess: false
    },
    uiMetadata: {
      color: '#dc2626',
      icon: 'Groups',
      popular: false,
      sortOrder: 9
    },
    isActive: true,
    includedCourses: [],
    trialPeriodDays: 0,
    allowPromotionCodes: true
  },
  {
    planId: 'VipEvent',
    displayName: {
      en: 'VIP Event',
      es: 'Evento VIP'
    },
    description: {
      en: 'Exclusive VIP trading event with limited seats',
      es: 'Evento VIP exclusivo de trading con cupos limitados'
    },
    stripeIds: {
      development: {
        productId: 'prod_RJKvnQ7LQ7GXYM',
        priceId: 'price_1RJKtNJ1acFkbhNIBNsLFT4p'
      },
      production: {
        productId: 'prod_PROD_VIP_EVENT', // TODO: Update with production ID
        priceId: 'price_PROD_VIP_EVENT' // TODO: Update with production ID
      }
    },
    pricing: {
      baseAmount: 99.99, // $99.99
      currency: 'usd',
      interval: PlanInterval.ONCE,
      intervalCount: 1
    },
    type: PlanType.EVENT,
    features: {
      en: [
        'VIP access',
        'Small group setting',
        'Direct mentorship',
        'Premium materials',
        'Networking dinner'
      ],
      es: [
        'Acceso VIP',
        'Grupos pequeños',
        'Mentoría directa',
        'Materiales premium',
        'Cena de networking'
      ]
    },
    conditionalPricing: [],
    meetingPermissions: {
      canCreateMeetings: false,
      maxMeetingsPerMonth: 0,
      maxMeetingDuration: 0,
      maxParticipantsPerMeeting: 0,
      canRecordMeetings: false,
      canScheduleMeetings: false,
      hasLiveMeetingAccess: false
    },
    uiMetadata: {
      color: '#fbbf24',
      icon: 'Star',
      badge: 'VIP',
      popular: false,
      sortOrder: 10
    },
    isActive: true,
    includedCourses: [],
    trialPeriodDays: 0,
    allowPromotionCodes: true
  }
];

async function migrateSubscriptionPlans() {
  const client = new MongoClient(MONGO_URI);

  try {
    await client.connect();
    console.log('Connected to MongoDB');

    const db = client.db();
    const collection = db.collection('subscription_plans');

    // Create backup of existing data
    const existingPlans = await collection.find({}).toArray();
    if (existingPlans.length > 0) {
      const backupCollection = db.collection('subscription_plans_backup_' + new Date().getTime());
      await backupCollection.insertMany(existingPlans);
      console.log(`Created backup with ${existingPlans.length} plans`);
    }

    let insertedCount = 0;
    let updatedCount = 0;
    let errorCount = 0;

    for (const plan of SUBSCRIPTION_PLANS) {
      try {
        // Check if plan exists
        const existing = await collection.findOne({ planId: plan.planId });
        
        if (existing) {
          // Update existing plan while preserving certain fields
          const updateData = {
            ...plan,
            // Preserve existing Stripe IDs if production ones are placeholders
            stripeIds: {
              development: plan.stripeIds.development,
              production: plan.stripeIds.production.priceId.includes('PROD_') 
                ? existing.stripeIds?.production || plan.stripeIds.production
                : plan.stripeIds.production
            },
            // Preserve creation date
            createdAt: existing.createdAt,
            updatedAt: new Date(),
            // Migrate legacy fields to new structure
            ...(existing.stripeProductId && !existing.stripeIds && {
              stripeIds: {
                development: {
                  productId: existing.stripeProductId,
                  priceId: existing.stripePriceId
                },
                production: plan.stripeIds.production
              }
            }),
            ...(existing.amount && !existing.pricing && {
              pricing: {
                baseAmount: existing.amount / 100, // Convert legacy cents to dollars
                currency: existing.currency || 'usd',
                interval: existing.interval || plan.pricing.interval,
                intervalCount: existing.intervalCount || 1
              }
            })
          };

          await collection.replaceOne(
            { planId: plan.planId },
            updateData
          );
          console.log(`✅ Updated plan: ${plan.planId}`);
          updatedCount++;
        } else {
          // Insert new plan
          await collection.insertOne({
            ...plan,
            createdAt: new Date(),
            updatedAt: new Date()
          });
          console.log(`✅ Inserted new plan: ${plan.planId}`);
          insertedCount++;
        }
      } catch (error) {
        console.error(`❌ Error processing plan ${plan.planId}:`, error);
        errorCount++;
      }
    }

    // Create indexes for better performance
    console.log('\nCreating indexes...');
    await collection.createIndex({ planId: 1 }, { unique: true });
    await collection.createIndex({ type: 1, isActive: 1 });
    await collection.createIndex({ 'uiMetadata.sortOrder': 1 });
    await collection.createIndex({ 'stripeIds.development.priceId': 1 });
    await collection.createIndex({ 'stripeIds.production.priceId': 1 });

    console.log('\n✨ Migration completed!');
    console.log(`Inserted: ${insertedCount} new plans`);
    console.log(`Updated: ${updatedCount} existing plans`);
    console.log(`Errors: ${errorCount}`);

    // Display all plans
    const allPlans = await collection.find({}).sort({ 'uiMetadata.sortOrder': 1 }).toArray();
    console.log('\nAll subscription plans:');
    allPlans.forEach(plan => {
      console.log(`\n- ${plan.planId}:`);
      console.log(`  Display: ${plan.displayName.en} / ${plan.displayName.es}`);
      console.log(`  Price: $${plan.pricing.baseAmount.toFixed(2)} ${plan.pricing.currency}`);
      console.log(`  Type: ${plan.type}`);
      console.log(`  Active: ${plan.isActive}`);
      console.log(`  Dev Price ID: ${plan.stripeIds.development.priceId}`);
      console.log(`  Prod Price ID: ${plan.stripeIds.production.priceId}`);
      if (plan.conditionalPricing && plan.conditionalPricing.length > 0) {
        console.log(`  Conditional Pricing: ${JSON.stringify(plan.conditionalPricing)}`);
      }
    });

  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await client.close();
    console.log('\nMongoDB connection closed');
  }
}

// Run the migration
if (require.main === module) {
  migrateSubscriptionPlans().catch(console.error);
}

export { migrateSubscriptionPlans, SUBSCRIPTION_PLANS };