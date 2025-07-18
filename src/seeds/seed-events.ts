import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { EventsServiceOptimized } from '../event/event.service.optimized';
import { Logger } from '@nestjs/common';

async function seedEvents() {
  const logger = new Logger('EventSeeder');
  const app = await NestFactory.createApplicationContext(AppModule);

  try {
    const eventsService = app.get(EventsServiceOptimized);

    // Check and create Master Course event
    logger.log('Checking for Master Course event...');
    const result = await eventsService.findAll(
      {},
      {
        isActive: true,
      },
    );

    const masterCourseEvent = result.data.find(
      (event) => event.type === 'master_course',
    );

    if (!masterCourseEvent) {
      logger.log('Creating Master Course event...');
      const masterCourse = await eventsService.create({
        name: 'Master Trading Course 2025',
        title: 'Curso Intensivo de Trading - 4 Meses de Transformación',
        description: 'Programa completo de formación en trading profesional',
        type: 'master_course',
        price: 2999.99,
        vipPrice: 2499.99,
        startDate: new Date('2025-01-15'),
        endDate: new Date('2025-05-15'),
        date: '2025-10-25',
        location: 'Miami, Florida',
        capacity: 50,
        currentRegistrations: 0,
        requiresActiveSubscription: false,
        isActive: true,
      });
      logger.log('✅ Master Course event created:', masterCourse._id);
    } else {
      logger.log(
        '✅ Master Course event already exists:',
        masterCourseEvent._id,
      );
    }

    // You can add more event seeds here if needed

    logger.log('✅ Event seeding completed successfully');
  } catch (error) {
    logger.error('❌ Error seeding events:', error);
    throw error;
  } finally {
    await app.close();
  }
}

seedEvents().catch((error) => {
  console.error(error);
  process.exit(1);
});
