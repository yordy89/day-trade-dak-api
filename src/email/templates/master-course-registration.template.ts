import {
  baseEmailTemplate,
  emailButton,
  emailDivider,
  emailInfoBox,
} from './base-email.template';

export interface MasterCourseRegistrationData {
  firstName: string;
  email: string;
  phoneNumber?: string;
  isPaid: boolean;
  amount?: number;
  currency?: string;
  paymentMethod?: string;
  additionalInfo?: {
    tradingExperience?: string;
    expectations?: string;
  };
  // Event date fields - dynamic from database
  eventName?: string;
  eventStartDate?: Date;
  eventEndDate?: Date;
  eventLocation?: string;
  firstSessionDate?: Date; // First online session date (before in-person)
}

const formatCurrency = (amount: number, currency: string): string => {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: currency.toUpperCase(),
    minimumFractionDigits: 2,
  }).format(amount);
};

// Format date in Spanish
const formatDateSpanish = (date: Date | undefined): string => {
  if (!date) return 'Por confirmar';
  const d = new Date(date);
  const months = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];
  return `${d.getDate()} de ${months[d.getMonth()]}, ${d.getFullYear()}`;
};

// Format date range in Spanish (e.g., "4-6 de Abril, 2026")
const formatDateRangeSpanish = (startDate: Date | undefined, endDate: Date | undefined): string => {
  if (!startDate) return 'Por confirmar';
  const start = new Date(startDate);
  const end = endDate ? new Date(endDate) : start;
  const months = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  // If same month
  if (start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear()) {
    return `${start.getDate()}-${end.getDate()} de ${months[start.getMonth()]}, ${start.getFullYear()}`;
  }
  // Different months
  return `${start.getDate()} de ${months[start.getMonth()]} - ${end.getDate()} de ${months[end.getMonth()]}, ${end.getFullYear()}`;
};

// Get month and year in Spanish (e.g., "Abril 2026")
const getMonthYearSpanish = (date: Date | undefined): string => {
  if (!date) return '';
  const d = new Date(date);
  const months = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];
  return `${months[d.getMonth()]} ${d.getFullYear()}`;
};

// Get year from date
const getYear = (date: Date | undefined): string => {
  if (!date) return new Date().getFullYear().toString();
  return new Date(date).getFullYear().toString();
};

// Calculate first session date (2 days before start)
const getFirstSessionDate = (startDate: Date | undefined, firstSession: Date | undefined): Date | undefined => {
  if (firstSession) return firstSession;
  if (!startDate) return undefined;
  const d = new Date(startDate);
  d.setDate(d.getDate() - 2);
  return d;
};

export const masterCourseRegistrationTemplate = (
  data: MasterCourseRegistrationData,
): string => {
  const {
    firstName,
    email,
    phoneNumber,
    isPaid,
    amount,
    currency,
    paymentMethod,
    additionalInfo,
    eventName,
    eventStartDate,
    eventEndDate,
    eventLocation,
    firstSessionDate,
  } = data;

  const formattedAmount =
    amount && currency ? formatCurrency(amount, currency) : null;

  // Dynamic date values
  const courseYear = getYear(eventStartDate);
  const courseName = eventName || `Master Trading Course ${courseYear}`;
  const dateRange = formatDateRangeSpanish(eventStartDate, eventEndDate);
  const monthYear = getMonthYearSpanish(eventStartDate);
  const location = eventLocation || 'Tampa, Florida';
  const firstSession = getFirstSessionDate(eventStartDate, firstSessionDate);
  const firstSessionFormatted = formatDateSpanish(firstSession);
  const endDateFormatted = formatDateSpanish(eventEndDate);

  const content = `
    <div style="text-align: center; margin-bottom: 30px;">
      <div style="display: inline-block; width: 80px; height: 80px; background: linear-gradient(135deg, #16a34a 0%, #22c55e 100%); border-radius: 50%; text-align: center; line-height: 80px; margin-bottom: 20px;">
        <span style="font-size: 40px;">🎓</span>
      </div>
      <h2 style="margin: 0 0 10px 0; color: #212636; font-size: 28px; font-weight: 700;">
        ¡Bienvenido al ${courseName}!
      </h2>
      <p style="margin: 0; color: #6b7280; font-size: 16px;">
        Tu transformación hacia el trading profesional comienza ahora
      </p>
    </div>

    <p style="margin: 0 0 20px 0; color: #4b5563; font-size: 16px; line-height: 24px;">
      Hola ${firstName},
    </p>

    <p style="margin: 0 0 30px 0; color: #4b5563; font-size: 16px; line-height: 24px;">
      <strong style="color: #16a34a;">¡Felicitaciones!</strong> Tu inscripción al <strong style="color: #212636;">${courseName}</strong> ha sido confirmada exitosamente.
      Has tomado la mejor decisión para tu futuro financiero. Durante los próximos 3 meses, te transformarás en un trader profesional con las herramientas y conocimientos necesarios para operar de manera consistente y rentable.
    </p>

    <!-- Course Overview -->
    <div style="background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); border-radius: 8px; padding: 24px; margin: 0 0 30px 0; border-left: 4px solid #16a34a;">
      <h3 style="margin: 0 0 20px 0; color: #16a34a; font-size: 20px; font-weight: 600;">
        📚 Tu Programa de Trading Profesional
      </h3>

      <table width="100%" cellpadding="0" cellspacing="0" style="font-size: 14px;">
        <tr>
          <td style="padding: 12px 0; color: #059669; font-weight: 600;" colspan="2">
            📅 Información General
          </td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #6b7280;">Duración Total:</td>
          <td style="padding: 8px 0; color: #212636; font-weight: 600; text-align: right;">3 Días Intensivos + 2.5 Meses de Práctica</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #6b7280;">Fechas Presencial:</td>
          <td style="padding: 8px 0; color: #212636; font-weight: 600; text-align: right;">${dateRange}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #6b7280;">Formato:</td>
          <td style="padding: 8px 0; color: #212636; text-align: right;">Online (15 días) + Presencial (3 días) + Práctica Supervisada (2 meses)</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #6b7280;">Ubicación presencial:</td>
          <td style="padding: 8px 0; color: #212636; text-align: right;">${location}</td>
        </tr>
        ${
          isPaid && formattedAmount
            ? `
        <tr>
          <td colspan="2" style="padding-top: 16px; border-top: 1px solid #d1fae5;"></td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #6b7280;">Inversión:</td>
          <td style="padding: 8px 0; color: #16a34a; font-weight: 700; text-align: right; font-size: 18px;">${formattedAmount}</td>
        </tr>
        ${
          paymentMethod === 'klarna'
            ? `
        <tr>
          <td colspan="2" style="padding: 4px 0; text-align: right;">
            <span style="color: #6b7280; font-size: 12px;">Pagado con Klarna - 4 cuotas sin interés</span>
          </td>
        </tr>
        `
            : ''
        }
        `
            : ''
        }
      </table>
    </div>

    <!-- Las 3 Fases -->
    <h3 style="margin: 30px 0 20px 0; color: #212636; font-size: 20px; font-weight: 600;">
      🚀 Las 3 Fases de Tu Transformación
    </h3>

    <!-- Fase 1 -->
    <div style="background-color: #f0fdf4; border-radius: 8px; padding: 20px; margin: 0 0 15px 0; border-left: 3px solid #16a34a;">
      <h4 style="margin: 0 0 10px 0; color: #16a34a; font-size: 16px; font-weight: 600;">
        Fase 1: Aprendizaje Online (Antes del Presencial${monthYear ? `, ${monthYear}` : ''})
      </h4>
      <p style="margin: 0 0 10px 0; color: #4b5563; font-size: 14px;">
        <strong>15 días antes del presencial • 8 lecciones en video + 4 mentorías vía Zoom</strong>
      </p>
      <ul style="margin: 0; padding-left: 20px; color: #6b7280; font-size: 14px; line-height: 22px;">
        <li>Introducción al mercado de valores</li>
        <li>Brokers y TC-2000</li>
        <li>Análisis fundamental e indicadores</li>
        <li>Análisis técnico y apertura del mercado</li>
        <li>4 mentorías en vivo para configurar tu plataforma</li>
        <li>Acceso a comunidad exclusiva de trading</li>
      </ul>
    </div>

    <!-- Fase 2 -->
    <div style="background-color: #eff6ff; border-radius: 8px; padding: 20px; margin: 0 0 15px 0; border-left: 3px solid #3b82f6;">
      <h4 style="margin: 0 0 10px 0; color: #3b82f6; font-size: 16px; font-weight: 600;">
        Fase 2: Entrenamiento Presencial en ${location.split(',')[0]} (3 Días Intensivos)
      </h4>
      <p style="margin: 0 0 10px 0; color: #4b5563; font-size: 14px;">
        <strong>${dateRange} (Viernes, Sábado y Domingo)</strong><br>
        <span style="color: #3b82f6; font-weight: 600;">📍 ${location}</span>
      </p>
      <ul style="margin: 0; padding-left: 20px; color: #6b7280; font-size: 14px; line-height: 22px;">
        <li><strong>Día 1:</strong> Estrategia y análisis en tiempo real</li>
        <li><strong>Día 2:</strong> Mentalidad, psicotrading y estrategias avanzadas</li>
        <li><strong>Día 3:</strong> Práctica en vivo y operativa guiada con capital real</li>
        <li>Sesiones de coaching uno a uno</li>
        <li>Networking profesional con traders exitosos</li>
      </ul>
      <div style="margin-top: 12px; padding: 10px; background-color: #fef3c7; border-radius: 6px; border-left: 3px solid #f59e0b;">
        <p style="margin: 0; color: #92400e; font-size: 12px;">
          <strong>⚠️ Importante:</strong> El alojamiento NO está incluido. Te enviaremos una lista de hoteles recomendados con tarifas especiales para nuestros estudiantes.
        </p>
      </div>
    </div>

    <!-- Fase 3 -->
    <div style="background-color: #fef3c7; border-radius: 8px; padding: 20px; margin: 0 0 30px 0; border-left: 3px solid #f59e0b;">
      <h4 style="margin: 0 0 10px 0; color: #f59e0b; font-size: 16px; font-weight: 600;">
        Fase 3: Práctica Supervisada (Después del Presencial, ${courseYear})
      </h4>
      <p style="margin: 0 0 10px 0; color: #4b5563; font-size: 14px;">
        <strong>2 Meses - 100% Online • Mes 1: Cuenta Demo | Mes 2: Cuenta Real</strong>
      </p>
      <ul style="margin: 0; padding-left: 20px; color: #6b7280; font-size: 14px; line-height: 22px;">
        <li><strong>Lunes a Viernes:</strong> Trading en vivo y acompañamiento diario</li>
        <li>Análisis previo al mercado cada mañana</li>
        <li>Operación en vivo con guía experta</li>
        <li>8 mentorías técnicas: estrategias, indicadores y manejo de cuentas</li>
        <li>8 mentorías de psicotrading: controla el miedo y opera con mentalidad rentable</li>
        <li><strong>🎓 Certificación Profesional de Trading al completar</strong></li>
      </ul>
    </div>

    <!-- What's Included -->
    <div style="background-color: #fafafa; border-radius: 8px; padding: 24px; margin: 0 0 30px 0;">
      <h3 style="margin: 0 0 20px 0; color: #212636; font-size: 18px; font-weight: 600;">
        ✅ Lo Que Incluye Tu Inscripción
      </h3>

      <div style="display: flex; flex-wrap: wrap; gap: 15px;">
        <div style="flex: 1 1 45%; min-width: 200px;">
          <p style="margin: 0 0 8px 0;">
            <span style="color: #16a34a; font-size: 20px;">📹</span>
            <strong style="color: #212636; font-size: 14px;"> 8 Módulos Especializados</strong>
          </p>
          <p style="margin: 0 0 15px 0; color: #6b7280; font-size: 13px; padding-left: 28px;">
            Contenido estructurado y práctico
          </p>
        </div>

        <div style="flex: 1 1 45%; min-width: 200px;">
          <p style="margin: 0 0 8px 0;">
            <span style="color: #16a34a; font-size: 20px;">📊</span>
            <strong style="color: #212636; font-size: 14px;"> Trading en vivo</strong>
          </p>
          <p style="margin: 0 0 15px 0; color: #6b7280; font-size: 13px; padding-left: 28px;">
            Opera con capital real junto a profesionales
          </p>
        </div>

        <div style="flex: 1 1 45%; min-width: 200px;">
          <p style="margin: 0 0 8px 0;">
            <span style="color: #16a34a; font-size: 20px;">👥</span>
            <strong style="color: #212636; font-size: 14px;"> 12+ Sesiones de Mentoría</strong>
          </p>
          <p style="margin: 0 0 15px 0; color: #6b7280; font-size: 13px; padding-left: 28px;">
            4 preparatorias + 8 técnicas + 8 psicotrading
          </p>
        </div>

        <div style="flex: 1 1 45%; min-width: 200px;">
          <p style="margin: 0 0 8px 0;">
            <span style="color: #16a34a; font-size: 20px;">🏆</span>
            <strong style="color: #212636; font-size: 14px;"> Certificación Profesional</strong>
          </p>
          <p style="margin: 0 0 15px 0; color: #6b7280; font-size: 13px; padding-left: 28px;">
            Certificado de Trading Profesional al completar
          </p>
        </div>

        <div style="flex: 1 1 45%; min-width: 200px;">
          <p style="margin: 0 0 8px 0;">
            <span style="color: #16a34a; font-size: 20px;">💬</span>
            <strong style="color: #212636; font-size: 14px;"> Comunidad Exclusiva</strong>
          </p>
          <p style="margin: 0 0 15px 0; color: #6b7280; font-size: 13px; padding-left: 28px;">
            Grupo privado de WhatsApp y soporte continuo
          </p>
        </div>
      </div>
    </div>

    <!-- Next Steps -->
    <h3 style="margin: 30px 0 20px 0; color: #212636; font-size: 20px; font-weight: 600;">
      ⚡ Próximos Pasos Importantes
    </h3>

    <div style="background-color: #fff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 0; margin: 0 0 30px 0;">
      <div style="padding: 15px; border-bottom: 1px solid #e5e7eb;">
        <p style="margin: 0; color: #16a34a; font-weight: 600;">
          <span style="font-size: 20px;">1️⃣</span> Accede a la plataforma
        </p>
        <p style="margin: 5px 0 0 28px; color: #6b7280; font-size: 14px;">
          En las próximas 24 horas recibirás un email con tus credenciales de acceso
        </p>
      </div>

      <div style="padding: 15px; border-bottom: 1px solid #e5e7eb;">
        <p style="margin: 0; color: #16a34a; font-weight: 600;">
          <span style="font-size: 20px;">2️⃣</span> Únete al grupo de WhatsApp
        </p>
        <p style="margin: 5px 0 0 28px; color: #6b7280; font-size: 14px;">
          Recibirás el link de invitación en un email separado
        </p>
      </div>

      <div style="padding: 15px; border-bottom: 1px solid #e5e7eb;">
        <p style="margin: 0; color: #16a34a; font-weight: 600;">
          <span style="font-size: 20px;">3️⃣</span> Prepara tu equipo
        </p>
        <p style="margin: 5px 0 0 28px; color: #6b7280; font-size: 14px;">
          Asegúrate de tener una computadora con buena conexión a internet
        </p>
      </div>

      <div style="padding: 15px;">
        <p style="margin: 0; color: #16a34a; font-weight: 600;">
          <span style="font-size: 20px;">4️⃣</span> Marca tu calendario
        </p>
        <p style="margin: 5px 0 0 28px; color: #6b7280; font-size: 14px;">
          Primera sesión en vivo: <strong>${firstSessionFormatted} a las 7:00 PM EST</strong>
        </p>
      </div>
    </div>

    <!-- Important Dates -->
    <div style="background: linear-gradient(135deg, #fef3c7 0%, #fed7aa 100%); border-radius: 8px; padding: 20px; margin: 0 0 30px 0;">
      <h4 style="margin: 0 0 15px 0; color: #92400e; font-size: 16px; font-weight: 600;">
        📅 Fechas Importantes para tu Agenda
      </h4>
      <table width="100%" cellpadding="0" cellspacing="0" style="font-size: 14px;">
        <tr>
          <td style="padding: 8px 0; color: #78350f; vertical-align: top;"><strong>${firstSessionFormatted}:</strong></td>
          <td style="padding: 8px 0; color: #78350f;">Inicio del curso - Primera sesión online a las 7:00 PM EST</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #78350f; vertical-align: top;"><strong>${dateRange}:</strong></td>
          <td style="padding: 8px 0; color: #78350f;">Entrenamiento presencial intensivo en ${location}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #78350f; vertical-align: top;"><strong>${endDateFormatted}:</strong></td>
          <td style="padding: 8px 0; color: #78350f;">Graduación y entrega de certificación oficial</td>
        </tr>
      </table>
    </div>

    ${emailDivider()}

    <!-- Support Section -->
    <div style="text-align: center; margin: 30px 0;">
      <h3 style="margin: 0 0 15px 0; color: #212636; font-size: 18px; font-weight: 600;">
        ¿Necesitas ayuda?
      </h3>
      <p style="margin: 0 0 20px 0; color: #6b7280; font-size: 14px;">
        Tu mentor está aquí para apoyarte en cada paso del camino
      </p>

      <div style="text-align: center;">
        <a href="https://wa.me/17863551346" target="_blank" style="display: inline-block; padding: 14px 32px; font-size: 16px; font-weight: 600; color: #ffffff; background-color: #25d366; text-decoration: none; border-radius: 6px; margin-bottom: 10px;">
          💬 WhatsApp: +1 786 355 1346
        </a>
      </div>
      <div style="text-align: center;">
        <a href="mailto:support@daytradedak.com" style="color: #16a34a; text-decoration: none; font-size: 14px;">
          📧 support@daytradedak.com
        </a>
      </div>
    </div>

    ${emailDivider()}

    <!-- Footer -->
    <div style="text-align: center; margin-top: 40px;">
      <p style="margin: 0 0 10px 0; color: #16a34a; font-size: 24px; font-weight: 700;">
        ¡Felicitaciones por dar este importante paso! 🎉
      </p>
      <p style="margin: 0 0 20px 0; color: #4b5563; font-size: 16px; line-height: 24px;">
        Has tomado la mejor decisión para tu futuro financiero.<br>
        Nos vemos en clase y prepárate para transformar tu vida<br>
        a través del trading profesional.
      </p>
      <p style="margin: 0; color: #6b7280; font-size: 14px;">
        Un abrazo,<br>
        <strong style="color: #212636;">El equipo de DayTradeDak</strong>
      </p>
    </div>
  `;

  return baseEmailTemplate({
    preheader: `¡Bienvenido al ${courseName}! Tu transformación comienza ahora`,
    content,
  });
};
