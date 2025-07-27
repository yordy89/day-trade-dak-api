import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { Model } from 'mongoose';

async function updateTampaCommunityEvent() {
  const app = await NestFactory.createApplicationContext(AppModule);

  try {
    const eventModel = app.get('EventModel') as Model<any>;

    console.log('🌟 Updating Tampa Community Event...\n');

    const eventId = '68716f1002c52f87285859b1';

    // Update the event with correct information
    const updateData = {
      name: 'Mentoría Presencial con Mijail Medina',
      title: 'Mentoría Presencial con Mijail Medina en Tampa',
      description: `3 días intensivos de inmersión total en el trading profesional. 
        Aprende directamente del mentor en sesiones de operación en vivo, 
        análisis técnico avanzado, gestión de riesgo y psicotrading. 
        Una experiencia transformadora para traders comprometidos.`,
      date: new Date('2025-09-25T08:30:00'),
      startDate: new Date('2025-09-25T08:30:00'),
      endDate: new Date('2025-09-27T17:30:00'),
      location:
        'Hilton Garden Inn Tampa Ybor Historic District, 1700 E 9th Ave, Tampa, FL 33605',
      vipPrice: 0,
      bannerImage: '/assets/images/comunity-event-backgorund.png',
      isActive: true,
      type: 'community_event',
      price: 599.99,
      requiresActiveSubscription: false, // Anyone can pay
      capacity: 50, // Cupo limitado
      metadata: {
        hotel: 'Hilton Garden Inn Tampa Ybor Historic District',
        hotelAddress: '1700 E 9th Ave, Tampa, FL 33605',
        includesAccommodation: false, // NOT included
        includesMeals: false, // Only Saturday dinner included
        includesSaturdayDinner: true,
        coordinates: {
          lat: 27.9594,
          lng: -82.4423,
        },
        schedule: {
          day1: {
            date: '2025-09-25',
            dayName: 'Jueves',
            title: 'Operación en Vivo & Análisis Técnico',
            morning: {
              title: 'MAÑANA - Operación en Vivo con el Mentor',
              time: '8:30 AM - 12:00 PM',
              activities: [
                'Revisión del calendario económico y noticias clave',
                'Selección de activos con potencial (watchlist real)',
                'Análisis técnico y definición de zonas estratégicas',
                'Entrada justificada, clara y explicada paso a paso',
                'Gestión profesional del trade en vivo',
                'Comentarios mentales del mentor durante la operación',
                'Reflexión post-trade: ¿Qué se respetó? ¿Qué se aprendió?',
              ],
            },
            afternoon: {
              title: 'TARDE - Módulo 1: Análisis Técnico Pre-Market',
              time: '2:00 PM - 5:30 PM',
              activities: [
                'Cómo interpretar el comportamiento del mercado',
                'Identificación de soportes, resistencias, liquidez y volumen',
                'Lectura de gráficos en varias temporalidades',
                'Construcción de un plan de acción diario',
                'Cómo evitar la improvisación con una estructura clara',
                'Ejercicio práctico: Análisis pre-market con feedback en vivo',
              ],
            },
          },
          day2: {
            date: '2025-09-26',
            dayName: 'Viernes',
            title: 'Entradas Profesionales & Gestión de Riesgo',
            morning: {
              title: 'MAÑANA - Segunda Sesión de Trading en Vivo',
              time: '8:30 AM - 12:00 PM',
              activities: [
                'Aplicación práctica de lo aprendido el día anterior',
                'Identificación de nuevas oportunidades en tiempo real',
                'Análisis de correlaciones entre activos',
                'Manejo de posiciones múltiples',
                'Control emocional bajo presión del mercado',
                'Evaluación y ajuste de estrategias en vivo',
              ],
            },
            afternoon: {
              title: 'TARDE - Módulos 2, 3 y 4',
              time: '2:00 PM - 5:30 PM',
              modules: [
                {
                  name: 'Módulo 2: Entradas Profesionales',
                  content: [
                    'Tipos de entrada: ruptura, pullback y rebote',
                    'Confirmaciones visuales y contextuales',
                    'Lectura del precio y comportamiento del volumen',
                    'Cómo filtrar entradas de bajo nivel',
                    'Checklist de entrada profesional',
                  ],
                },
                {
                  name: 'Módulo 3: Gestión de Riesgo',
                  content: [
                    'Cálculo de riesgo por operación basado en tu capital',
                    'Cómo definir el tamaño de posición ideal',
                    'Uso correcto del stop loss y take profits',
                    'Planificación mensual de crecimiento de cuenta',
                  ],
                },
                {
                  name: 'Módulo 4: Precisión Bajo Presión',
                  content: [
                    'Cuándo reforzar una entrada ya abierta',
                    'Cómo distinguir entre pullback y nueva oportunidad',
                    'Simulación de entradas con feedback en tiempo real',
                  ],
                },
              ],
            },
          },
          day3: {
            date: '2025-09-27',
            dayName: 'Sábado',
            title: 'Psicotrading & Celebración',
            morning: {
              title: 'MAÑANA - Módulo Especial: Psicotrading',
              time: '8:30 AM - 12:00 PM',
              activities: [
                'Cómo eliminar el miedo a perder y la ansiedad por ganar',
                'Técnicas mentales para mantener la calma bajo presión',
                'Identificar patrones mentales que sabotean tus trades',
                'Construcción de un ritual mental pre-sesión',
                'Disciplina emocional en entornos de incertidumbre',
                'Ejercicio guiado: Visualización del "Yo Trader" profesional',
              ],
            },
            afternoon: {
              title: 'TARDE - Actividad Recreativa & Cierre',
              time: '2:00 PM - 5:30 PM',
              activities: [
                'Actividad relajante (comida y experiencia grupal)',
                'Conversaciones abiertas con el mentor y compañeros',
                'Círculo de visión: ¿A dónde voy como trader después de esto?',
                'Foto oficial y cierre inspirador',
                'Networking y creación de lazos con la comunidad',
              ],
              specialDinner: {
                time: '6:00 PM - 8:00 PM',
                description:
                  'Cena especial del sábado incluida para todos los participantes y sus invitados',
              },
            },
          },
        },
        included: [
          '3 días intensivos de mentoría presencial',
          'Operación en vivo con Mijail Medina',
          'Módulo completo de Psicotrading',
          'Cena especial del sábado',
          'Material y plantillas profesionales',
          'Certificado de participación',
          'Networking con traders serios',
        ],
        notIncluded: [
          'Alojamiento',
          'Desayunos y almuerzos',
          'Transporte',
          'Vuelos',
        ],
        requirements: [
          'Laptop para las sesiones prácticas',
          'Libreta para tomar notas',
          'Compromiso con el aprendizaje',
          'Puntualidad en todas las sesiones',
        ],
        contact: {
          phone: '+1 (786) 355-1346',
          email: 'support@daytradedak.com',
        },
      },
    };

    const result = await eventModel.findByIdAndUpdate(
      eventId,
      { $set: updateData },
      { new: true },
    );

    if (result) {
      console.log('✅ Tampa Community Event updated successfully!');
      console.log(`   ID: ${result._id}`);
      console.log(`   Name: ${result.name}`);
      console.log(`   Location: ${result.location}`);
      console.log(`   Dates: ${result.startDate} - ${result.endDate}`);
      console.log(`   Price: $${result.price}`);
      console.log(`   Capacity: ${result.capacity} attendees`);
    } else {
      console.log('❌ Event not found with ID:', eventId);
    }
  } catch (error) {
    console.error('❌ Error updating community event:', error);
  } finally {
    await app.close();
  }
}

// Run the update
updateTampaCommunityEvent()
  .then(() => {
    console.log('\n✅ Update complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Update failed:', error);
    process.exit(1);
  });
