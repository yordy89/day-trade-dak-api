import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { EventsServiceOptimized } from '../event/event.service.optimized';
import { Model } from 'mongoose';

async function seedCommunityEvent() {
  const app = await NestFactory.createApplicationContext(AppModule);

  try {
    const eventsService = app.get(EventsServiceOptimized);
    const eventModel = app.get('EventModel') as Model<any>;

    console.log('🌟 Creating Community Event...\n');

    // Check if community event already exists
    const existingEvents = await eventModel
      .find({ type: 'community_event' })
      .exec();

    if (existingEvents.length > 0) {
      console.log('⚠️  Community event already exists:');
      console.log(`   ID: ${existingEvents[0]._id}`);
      console.log(`   Name: ${existingEvents[0].name}`);
      return;
    }

    // Create community event
    const communityEvent = await eventsService.create({
      name: 'Trading Paradise Cancún 2025',
      title: 'El Evento de Trading Más Exclusivo del Año',
      description: `Únete a la élite del trading en una experiencia única de 4 días en Cancún. 
        Este evento exclusivo combina educación de alto nivel, networking premium y momentos inolvidables 
        en uno de los destinos más paradisíacos del mundo.`,
      date: '2025-06-15', // Required date field
      startDate: new Date('2025-06-15'),
      endDate: new Date('2025-06-18'),
      location: 'Hotel Grand Velas Riviera Maya, Cancún',
      vipPrice: 0, // Free for members
      bannerImage: '/images/events/cancun-trading-paradise.jpg',
      isActive: true,
      type: 'community_event',
      price: 599.99, // Community event price
      requiresActiveSubscription: true,
      capacity: 100,
      currentRegistrations: 0,
      metadata: {
        hotel: 'Hotel Grand Velas Riviera Maya',
        hotelWebsite: 'https://www.rivieramaya.grandvelas.com',
        includesAccommodation: true,
        includesMeals: true,
        activities: [
          'Trading masterclasses exclusivas',
          'Sesiones de networking premium',
          'Análisis de mercado en vivo',
          'Actividades recreativas',
          'Cenas temáticas',
          'Acceso a instalaciones del resort',
        ],
        requirements: {
          subscription: 'Live Weekly',
          subscriptionTypes: ['LiveWeeklyManual', 'LiveWeeklyRecurring'],
          message:
            'Este evento es exclusivo para miembros activos de Live Weekly',
        },
        agenda: {
          day1: {
            title: 'Día 1 - Llegada y Bienvenida',
            activities: [
              { time: '15:00', activity: 'Check-in y registro' },
              { time: '19:00', activity: 'Cóctel de bienvenida' },
              { time: '20:30', activity: 'Cena de inauguración' },
            ],
          },
          day2: {
            title: 'Día 2 - Inmersión en Trading',
            activities: [
              { time: '08:00', activity: 'Desayuno' },
              { time: '09:00', activity: 'Masterclass: Estrategias Avanzadas' },
              { time: '11:00', activity: 'Coffee break & Networking' },
              { time: '11:30', activity: 'Panel: Psicología del Trading' },
              { time: '13:00', activity: 'Almuerzo' },
              { time: '15:00', activity: 'Sesión práctica: Trading en vivo' },
              { time: '17:00', activity: 'Tiempo libre - Playa/Spa' },
              { time: '20:00', activity: 'Cena temática' },
            ],
          },
          day3: {
            title: 'Día 3 - Estrategias y Diversión',
            activities: [
              { time: '08:00', activity: 'Desayuno' },
              { time: '09:00', activity: 'Workshop: Gestión de riesgo' },
              { time: '11:00', activity: 'Actividad grupal en la playa' },
              { time: '13:00', activity: 'Almuerzo' },
              { time: '15:00', activity: 'Competencia de trading' },
              { time: '17:00', activity: 'Premiación y celebración' },
              { time: '20:00', activity: 'Cena de gala' },
            ],
          },
          day4: {
            title: 'Día 4 - Cierre y Despedida',
            activities: [
              { time: '08:00', activity: 'Desayuno' },
              { time: '10:00', activity: 'Sesión de cierre: Plan de acción' },
              { time: '11:30', activity: 'Ceremonia de clausura' },
              { time: '12:00', activity: 'Check-out' },
            ],
          },
        },
      },
    });

    console.log('✅ Community event created successfully!');
    console.log(`   ID: ${communityEvent._id}`);
    console.log(`   Name: ${communityEvent.name}`);
    console.log(`   Type: ${communityEvent.type}`);
    console.log(`   Location: ${communityEvent.location}`);
    console.log(
      `   Dates: ${communityEvent.startDate} - ${communityEvent.endDate}`,
    );
    console.log(
      `   Requires Active Subscription: ${communityEvent.requiresActiveSubscription}`,
    );
    console.log(`   Capacity: ${communityEvent.capacity} attendees`);
  } catch (error) {
    console.error('❌ Error creating community event:', error);
  } finally {
    await app.close();
  }
}

// Run the seed
seedCommunityEvent()
  .then(() => {
    console.log('\n✅ Seed complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  });
