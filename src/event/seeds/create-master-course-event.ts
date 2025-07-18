// Script to create Master Course event in the database
// Run with: ts-node src/event/seeds/create-master-course-event.ts

import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../app.module';
import { EventsServiceOptimized } from '../event.service.optimized';
import { Logger } from '@nestjs/common';

async function createMasterCourseEvent() {
  const logger = new Logger('EventSeeder');

  try {
    // Create NestJS application context
    const app = await NestFactory.createApplicationContext(AppModule);
    const eventsService = app.get(EventsServiceOptimized);

    // Check if Master Course event already exists
    const result = await eventsService.findAll(
      {},
      {
        isActive: true,
      },
    );

    const existingMasterCourse = result.data.find(
      (event) => event.type === 'master_course',
    );

    if (existingMasterCourse) {
      logger.log(
        'Master Course event already exists:',
        existingMasterCourse._id,
      );
      await app.close();
      return;
    }

    // Create Master Course event
    const newMasterCourseEvent = await eventsService.create({
      name: 'Master Trading Course 2025',
      title: 'Curso Intensivo de Trading - 4 Meses de Transformación',
      description: `Programa completo de formación en trading que incluye:
        - 2 meses de aprendizaje online con 8 módulos especializados
        - 3 días de entrenamiento presencial en Miami
        - 2 meses de práctica supervisada con mentorías semanales
        - Certificación profesional al completar el programa`,
      type: 'master_course',
      price: 2999.99,
      vipPrice: 2499.99, // VIP price for early birds or special promotions
      startDate: new Date('2025-01-15'), // Course starts
      endDate: new Date('2025-05-15'), // Course ends (4 months)
      date: '2025-10-25', // In-person training date
      location: 'Miami, Florida - Hotel Intercontinental',
      capacity: 50, // Maximum students
      currentRegistrations: 0,
      requiresActiveSubscription: false, // No subscription needed
      isActive: true,
      metadata: {
        phases: [
          {
            phase: 1,
            name: 'Aprendizaje Online',
            duration: '2 meses',
            startDate: '2025-01-15',
            endDate: '2025-03-15',
            includes: [
              '8 módulos de contenido',
              '4 mentorías grupales',
              'Material descargable',
              'Acceso a comunidad',
            ],
          },
          {
            phase: 2,
            name: 'Entrenamiento Presencial',
            duration: '3 días',
            dates: ['2025-10-25', '2025-10-26', '2025-10-27'],
            location: 'Miami, Florida',
            includes: [
              'Trading en vivo',
              'Práctica con capital real',
              'Networking profesional',
              'Comidas incluidas',
            ],
          },
          {
            phase: 3,
            name: 'Práctica Supervisada',
            duration: '2 meses',
            startDate: '2025-10-28',
            endDate: '2025-12-28',
            includes: [
              'Seguimiento personalizado',
              'Grupo WhatsApp privado',
              'Sesiones Q&A semanales',
              'Certificación final',
            ],
          },
        ],
        instructors: ['Yordy - CEO & Head Trader', 'Trading Team Profesional'],
        requirements: [
          'Compromiso de 4 meses',
          'Laptop o computadora',
          'Capital inicial para práctica (mínimo $500)',
          'Disponibilidad para viajar a Miami',
        ],
        certification: true,
        language: 'Español',
        supportEmail: 'mastertrading@daytradedash.com',
        whatsappSupport: '+1234567890',
      },
    });

    logger.log(
      '✅ Master Course event created successfully:',
      newMasterCourseEvent,
    );

    await app.close();
  } catch (error) {
    logger.error('Error creating Master Course event:', error);
    process.exit(1);
  }
}

// Run the seeder
createMasterCourseEvent();
