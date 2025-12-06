import {
  baseEmailTemplate,
  emailButton,
  emailDivider,
  emailInfoBox,
} from './base-email.template';

export interface EventRegistrationData {
  firstName: string;
  eventName: string;
  eventType: 'master_course' | 'community_event' | 'vip_event' | 'webinar' | 'workshop' | 'seminar' | 'bootcamp' | 'conference';
  eventDate?: Date;
  eventStartDate?: Date;
  eventEndDate?: Date;
  eventTime?: string;
  eventTimezone?: string; // IANA timezone string (e.g., 'America/New_York')
  eventLocation?: string;
  eventDescription?: string;
  ticketNumber?: string;
  isPaid: boolean;
  amount?: number;
  currency?: string;
  additionalAdults?: number;
  additionalChildren?: number;
  hotelName?: string;
  hotelAddress?: string;
  isOnline?: boolean;
  meetingLink?: string;
  additionalInfo?: {
    phoneNumber?: string;
    paymentMethod?: string;
    tradingExperience?: string;
    expectations?: string;
    [key: string]: any;
  };
}

// Region-specific timezone defaults
const REGION_TIMEZONES: Record<string, string> = {
  'us': 'America/New_York',
  'es': 'Europe/Madrid',
  'mx': 'America/Mexico_City',
  'co': 'America/Bogota',
};

// Timezone labels in Spanish
const TIMEZONE_LABELS: Record<string, string> = {
  'America/New_York': 'Hora del Este',
  'America/Chicago': 'Hora Central',
  'America/Denver': 'Hora de la Montaña',
  'America/Los_Angeles': 'Hora del Pacífico',
  'Europe/Madrid': 'Hora España',
  'Europe/London': 'Hora Reino Unido',
  'America/Mexico_City': 'Hora México',
  'America/Bogota': 'Hora Colombia',
  'America/Lima': 'Hora Perú',
  'America/Santiago': 'Hora Chile',
  'America/Argentina/Buenos_Aires': 'Hora Argentina',
};

/**
 * Safely parse and format a date without timezone conversion issues.
 * Extracts just the date part and formats it to avoid UTC->local conversion.
 */
const formatDate = (date: Date): string => {
  // Convert to ISO string and extract just the date part to avoid timezone issues
  const isoString = date instanceof Date ? date.toISOString() : String(date);
  const dateOnly = isoString.split('T')[0];
  // Parse the date parts manually to avoid any timezone interpretation
  const [year, month, day] = dateOnly.split('-').map(Number);

  // Use UTC methods to format the date to avoid timezone shifts
  const months = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
                  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const weekdays = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

  // Create date at UTC noon to get correct day of week
  const utcDate = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  const dayOfWeek = utcDate.getUTCDay();

  return `${weekdays[dayOfWeek]}, ${day} de ${months[month - 1]} de ${year}`;
};

/**
 * Format time in a specific timezone
 * @param date - The UTC date
 * @param timezone - IANA timezone string (e.g., 'America/New_York')
 */
const formatTime = (date: Date, timezone?: string): string => {
  const tz = timezone || 'America/New_York';
  return new Intl.DateTimeFormat('es-ES', {
    timeZone: tz,
    hour: 'numeric',
    minute: '2-digit',
    hour12: false,
  }).format(date);
};

/**
 * Get the timezone label for display
 */
const getTimezoneLabel = (timezone?: string): string => {
  const tz = timezone || 'America/New_York';
  return TIMEZONE_LABELS[tz] || tz;
};

const formatDateRange = (startDate: Date, endDate: Date): string => {
  const months = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
                  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const weekdayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

  // Extract date parts from ISO strings to avoid timezone issues
  const startIso = startDate instanceof Date ? startDate.toISOString() : String(startDate);
  const endIso = endDate instanceof Date ? endDate.toISOString() : String(endDate);

  const [startYear, startMonth, startDay] = startIso.split('T')[0].split('-').map(Number);
  const [endYear, endMonth, endDay] = endIso.split('T')[0].split('-').map(Number);

  // Get day names using UTC
  const days = [];
  for (let d = startDay; d <= endDay; d++) {
    const utcDate = new Date(Date.UTC(startYear, startMonth - 1, d, 12, 0, 0));
    days.push(weekdayNames[utcDate.getUTCDay()]);
  }

  // Build day numbers array
  const dayNumbers = [];
  for (let d = startDay; d <= endDay; d++) {
    dayNumbers.push(d);
  }

  return `${days.join(' - ')}. ${dayNumbers.join(', ')} de ${months[startMonth - 1]}, ${startYear}`;
};

const getFirstDayName = (date: Date): string => {
  const weekdayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

  // Extract date parts from ISO string to avoid timezone issues
  const isoString = date instanceof Date ? date.toISOString() : String(date);
  const [year, month, day] = isoString.split('T')[0].split('-').map(Number);

  // Use UTC to get correct day of week
  const utcDate = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  return weekdayNames[utcDate.getUTCDay()];
};

const formatCurrency = (amount: number, currency: string): string => {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: currency.toUpperCase(),
    minimumFractionDigits: 2,
  }).format(amount);
};

const getEventTypeInfo = (
  eventType: string,
): { emoji: string; color: string; title: string } => {
  const types = {
    master_course: {
      emoji: '🎓',
      color: '#8b5cf6',
      title: 'Master Course',
    },
    community_event: {
      emoji: '👥',
      color: '#16a34a',
      title: 'Evento de la Comunidad',
    },
    vip_event: {
      emoji: '⭐',
      color: '#f59e0b',
      title: 'Evento VIP',
    },
    webinar: {
      emoji: '🎥',
      color: '#22c55e',
      title: 'Webinar en Vivo',
    },
    workshop: {
      emoji: '🛠️',
      color: '#3b82f6',
      title: 'Workshop',
    },
    seminar: {
      emoji: '📚',
      color: '#a855f7',
      title: 'Seminario',
    },
    bootcamp: {
      emoji: '🚀',
      color: '#ef4444',
      title: 'Bootcamp',
    },
    conference: {
      emoji: '🎤',
      color: '#6366f1',
      title: 'Conferencia',
    },
  };

  return types[eventType] || types.community_event;
};

// Webinar-specific email template
const webinarRegistrationTemplate = (data: EventRegistrationData): string => {
  const {
    firstName,
    eventName,
    eventDate,
    eventTime,
    eventTimezone,
    eventLocation,
    ticketNumber,
    meetingLink,
  } = data;

  const formattedDate = eventDate ? formatDate(eventDate) : null;
  const formattedTime = eventDate ? formatTime(eventDate, eventTimezone) : eventTime;
  const timezoneLabel = getTimezoneLabel(eventTimezone);

  const content = `
    <div style="text-align: center; margin-bottom: 30px;">
      <div style="display: inline-block; width: 80px; height: 80px; background-color: #22c55e15; border-radius: 50%; text-align: center; line-height: 80px; margin-bottom: 20px;">
        <span style="font-size: 40px;">🎉</span>
      </div>
      <h2 style="margin: 0 0 10px 0; color: #212636; font-size: 28px; font-weight: 600;">
        ¡Felicidades, ${firstName}!
      </h2>
      <p style="margin: 0; color: #22c55e; font-size: 18px; font-weight: 600;">
        Tu lugar está reservado
      </p>
    </div>

    <div style="background: linear-gradient(135deg, #22c55e15 0%, #16a34a15 100%); border-radius: 12px; padding: 24px; margin: 0 0 30px 0; border-left: 4px solid #22c55e;">
      <p style="margin: 0; color: #4b5563; font-size: 16px; line-height: 24px;">
        Has asegurado tu cupo para el webinar exclusivo:
      </p>
      <h3 style="margin: 10px 0 0 0; color: #212636; font-size: 22px; font-weight: 700;">
        Acceso Blindado: La Metodología Silenciosa que el 95% de los Traders Desconoce
      </h3>
    </div>

    <div style="background-color: #1f2937; border-radius: 12px; padding: 24px; margin: 0 0 30px 0; color: white;">
      <h3 style="margin: 0 0 20px 0; color: #22c55e; font-size: 18px; font-weight: 600;">
        📅 Detalles del Webinar
      </h3>

      <table width="100%" cellpadding="0" cellspacing="0" style="font-size: 15px;">
        <tr>
          <td style="padding: 12px 0; color: #9ca3af; vertical-align: middle;">
            <span style="font-size: 18px; margin-right: 8px;">📆</span> Fecha:
          </td>
          <td style="padding: 12px 0; color: white; font-weight: 600; text-align: right;">
            ${formattedDate || 'Por confirmar'}
          </td>
        </tr>
        <tr>
          <td style="padding: 12px 0; color: #9ca3af; vertical-align: middle; border-top: 1px solid #374151;">
            <span style="font-size: 18px; margin-right: 8px;">⏰</span> Hora:
          </td>
          <td style="padding: 12px 0; color: white; font-weight: 600; text-align: right; border-top: 1px solid #374151;">
            ${formattedTime || '17:00'} (${timezoneLabel})
          </td>
        </tr>
        <tr>
          <td style="padding: 12px 0; color: #9ca3af; vertical-align: middle; border-top: 1px solid #374151;">
            <span style="font-size: 18px; margin-right: 8px;">📍</span> Modalidad:
          </td>
          <td style="padding: 12px 0; color: #22c55e; font-weight: 600; text-align: right; border-top: 1px solid #374151;">
            🌐 100% Online - EN VIVO
          </td>
        </tr>
        <tr>
          <td style="padding: 12px 0; color: #9ca3af; vertical-align: middle; border-top: 1px solid #374151;">
            <span style="font-size: 18px; margin-right: 8px;">💰</span> Inversión:
          </td>
          <td style="padding: 12px 0; color: #22c55e; font-weight: 700; text-align: right; font-size: 18px; border-top: 1px solid #374151;">
            GRATIS
          </td>
        </tr>
      </table>
    </div>

    <div style="background-color: #fef3c7; border-radius: 12px; padding: 20px; margin: 0 0 30px 0; border-left: 4px solid #f59e0b;">
      <p style="margin: 0 0 5px 0; color: #92400e; font-size: 14px; font-weight: 600;">
        ⚠️ IMPORTANTE
      </p>
      <p style="margin: 0; color: #78350f; font-size: 14px; line-height: 21px;">
        Esta sesión es <strong>ÚNICA</strong> y <strong>NO se va a repetir</strong>. Asegúrate de estar puntual para no perderte nada.
      </p>
    </div>

    <h3 style="margin: 30px 0 15px 0; color: #212636; font-size: 18px; font-weight: 600;">
      🎯 Lo que aprenderás en este webinar exclusivo:
    </h3>

    <div style="margin: 0 0 30px 0;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="padding: 10px 0; vertical-align: top; width: 30px;">
            <span style="display: inline-block; width: 24px; height: 24px; background-color: #22c55e; border-radius: 50%; color: white; text-align: center; line-height: 24px; font-size: 14px; font-weight: bold;">1</span>
          </td>
          <td style="padding: 10px 0; padding-left: 12px; color: #4b5563; font-size: 15px;">
            <strong style="color: #212636;">Los mitos del trading</strong> - Desmantelaremos las falsas "soluciones rápidas"
          </td>
        </tr>
        <tr>
          <td style="padding: 10px 0; vertical-align: top; width: 30px;">
            <span style="display: inline-block; width: 24px; height: 24px; background-color: #22c55e; border-radius: 50%; color: white; text-align: center; line-height: 24px; font-size: 14px; font-weight: bold;">2</span>
          </td>
          <td style="padding: 10px 0; padding-left: 12px; color: #4b5563; font-size: 15px;">
            <strong style="color: #212636;">El problema del trader típico</strong> - Por qué la falta de estructura causa estancamiento
          </td>
        </tr>
        <tr>
          <td style="padding: 10px 0; vertical-align: top; width: 30px;">
            <span style="display: inline-block; width: 24px; height: 24px; background-color: #22c55e; border-radius: 50%; color: white; text-align: center; line-height: 24px; font-size: 14px; font-weight: bold;">3</span>
          </td>
          <td style="padding: 10px 0; padding-left: 12px; color: #4b5563; font-size: 15px;">
            <strong style="color: #212636;">El filtro de precisión</strong> - Enfócate solo en operaciones de alto impacto
          </td>
        </tr>
        <tr>
          <td style="padding: 10px 0; vertical-align: top; width: 30px;">
            <span style="display: inline-block; width: 24px; height: 24px; background-color: #22c55e; border-radius: 50%; color: white; text-align: center; line-height: 24px; font-size: 14px; font-weight: bold;">4</span>
          </td>
          <td style="padding: 10px 0; padding-left: 12px; color: #4b5563; font-size: 15px;">
            <strong style="color: #212636;">Pilares de la metodología profesional</strong> - Análisis flexible vs estrategias rígidas
          </td>
        </tr>
        <tr>
          <td style="padding: 10px 0; vertical-align: top; width: 30px;">
            <span style="display: inline-block; width: 24px; height: 24px; background-color: #22c55e; border-radius: 50%; color: white; text-align: center; line-height: 24px; font-size: 14px; font-weight: bold;">5</span>
          </td>
          <td style="padding: 10px 0; padding-left: 12px; color: #4b5563; font-size: 15px;">
            <strong style="color: #212636;">Estudio de caso real</strong> - Gráficos limpios y metodología en práctica
          </td>
        </tr>
      </table>
    </div>

    <div style="background-color: #f0fdf4; border-radius: 12px; padding: 24px; margin: 0 0 30px 0; text-align: center;">
      <p style="margin: 0 0 15px 0; color: #166534; font-size: 16px; font-weight: 600;">
        🔔 Próximos pasos
      </p>
      <ol style="margin: 0; padding-left: 20px; color: #15803d; font-size: 14px; line-height: 24px; text-align: left; display: inline-block;">
        <li>Guarda la fecha en tu calendario</li>
        <li>Prepara libreta para tomar notas</li>
        <li>Te enviaremos el enlace de acceso antes del webinar</li>
        <li>Conéctate 5 minutos antes para asegurar tu lugar</li>
      </ol>
    </div>

    ${emailDivider()}

    <div style="text-align: center;">
      <p style="margin: 0 0 10px 0; color: #6b7280; font-size: 14px;">
        ¿Tienes preguntas? Contáctanos:
      </p>
      <p style="margin: 0; color: #6b7280; font-size: 14px;">
        <a href="mailto:support@daytradedak.com" style="color: #22c55e; text-decoration: none; font-weight: 600;">support@daytradedak.com</a>
      </p>
    </div>

    <p style="margin: 30px 0 0 0; color: #4b5563; font-size: 16px; line-height: 24px; text-align: center;">
      ¡Nos vemos en el webinar!<br>
      <strong style="color: #212636;">El equipo de DayTradeDak Academy</strong>
    </p>

    <div style="margin-top: 30px; padding: 20px; background-color: #f3f4f6; border-radius: 8px; text-align: center;">
      <p style="margin: 0; color: #6b7280; font-size: 12px;">
        Este correo es tu confirmación de registro. Por favor, guárdalo.<br>
        ${ticketNumber ? `Número de ticket: <strong>${ticketNumber}</strong>` : ''}
      </p>
    </div>
  `;

  return baseEmailTemplate({
    preheader: `¡Confirmado! Tu lugar para el webinar exclusivo está reservado`,
    content,
  });
};

// Default template for other event types
const defaultEventRegistrationTemplate = (
  data: EventRegistrationData,
): string => {
  const {
    firstName,
    eventName,
    eventType,
    eventDate,
    eventStartDate,
    eventEndDate,
    eventTime,
    eventLocation,
    eventDescription,
    ticketNumber,
    isPaid,
    amount,
    currency,
    additionalAdults = 0,
    additionalChildren = 0,
    hotelName,
    hotelAddress,
  } = data;

  const { emoji, color, title: eventTypeTitle } = getEventTypeInfo(eventType);
  const formattedDate = eventDate ? formatDate(eventDate) : null;
  const formattedAmount =
    amount && currency ? formatCurrency(amount, currency) : null;

  const content = `
    <div style="text-align: center; margin-bottom: 30px;">
      <div style="display: inline-block; width: 80px; height: 80px; background-color: ${color}15; border-radius: 50%; text-align: center; line-height: 80px; margin-bottom: 20px;">
        <span style="font-size: 40px;">${emoji}</span>
      </div>
      <h2 style="margin: 0 0 10px 0; color: #212636; font-size: 28px; font-weight: 600;">
        ¡Registro confirmado!
      </h2>
      <p style="margin: 0; color: #6b7280; font-size: 16px;">
        Tu lugar está reservado para el evento
      </p>
    </div>

    <p style="margin: 0 0 20px 0; color: #4b5563; font-size: 16px; line-height: 24px;">
      Hola ${firstName},
    </p>

    <p style="margin: 0 0 30px 0; color: #4b5563; font-size: 16px; line-height: 24px;">
      ¡Excelente noticia! Tu registro para <strong style="color: #212636;">${eventName}</strong> ha sido confirmado exitosamente.
    </p>

    <div style="background-color: #f9fafb; border-radius: 8px; padding: 24px; margin: 0 0 30px 0;">
      <h3 style="margin: 0 0 20px 0; color: #212636; font-size: 18px; font-weight: 600;">
        📋 Detalles del evento
      </h3>

      <table width="100%" cellpadding="0" cellspacing="0" style="font-size: 14px;">
        <tr>
          <td style="padding: 8px 0; color: #6b7280; vertical-align: top;">Evento:</td>
          <td style="padding: 8px 0; color: #212636; font-weight: 600; text-align: right;">${eventName}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #6b7280;">Tipo:</td>
          <td style="padding: 8px 0; color: ${color}; font-weight: 600; text-align: right;">${eventTypeTitle}</td>
        </tr>
        ${
          formattedDate
            ? `
        <tr>
          <td style="padding: 8px 0; color: #6b7280;">Fecha:</td>
          <td style="padding: 8px 0; color: #212636; text-align: right;">${formattedDate}</td>
        </tr>
        `
            : ''
        }
        ${
          eventTime
            ? `
        <tr>
          <td style="padding: 8px 0; color: #6b7280;">Hora:</td>
          <td style="padding: 8px 0; color: #212636; text-align: right;">${eventTime}</td>
        </tr>
        `
            : ''
        }
        ${
          eventLocation
            ? `
        <tr>
          <td style="padding: 8px 0; color: #6b7280;">Ubicación:</td>
          <td style="padding: 8px 0; color: #212636; text-align: right;">${eventLocation}</td>
        </tr>
        `
            : ''
        }
        ${
          (additionalAdults > 0 || additionalChildren > 0) &&
          eventType === 'community_event'
            ? `
        <tr>
          <td colspan="2" style="padding-top: 16px; border-top: 1px solid #e5e7eb;"></td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #6b7280;">Invitados adicionales:</td>
          <td style="padding: 8px 0; color: #212636; text-align: right;">
            ${additionalAdults > 0 ? `${additionalAdults} adulto${additionalAdults > 1 ? 's' : ''}` : ''}
            ${additionalAdults > 0 && additionalChildren > 0 ? ' y ' : ''}
            ${additionalChildren > 0 ? `${additionalChildren} niño${additionalChildren > 1 ? 's' : ''}` : ''}
          </td>
        </tr>
        `
            : ''
        }
        ${
          isPaid && formattedAmount
            ? `
        <tr>
          <td colspan="2" style="padding-top: 16px; border-top: 1px solid #e5e7eb;"></td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #6b7280;">Monto pagado:</td>
          <td style="padding: 8px 0; color: #212636; font-weight: 600; text-align: right; font-size: 16px;">${formattedAmount}</td>
        </tr>
        `
            : ''
        }
        ${
          ticketNumber
            ? `
        <tr>
          <td style="padding: 8px 0; color: #6b7280; font-size: 12px;">Número de ticket:</td>
          <td style="padding: 8px 0; color: #6b7280; text-align: right; font-size: 12px; font-family: monospace;">${ticketNumber}</td>
        </tr>
        `
            : ''
        }
      </table>
    </div>

    ${
      eventDescription
        ? `
      <div style="background-color: #eff6ff; border-radius: 8px; padding: 20px; margin: 0 0 30px 0;">
        <p style="margin: 0 0 10px 0; color: #1e40af; font-size: 16px; font-weight: 600;">
          Acerca del evento
        </p>
        <p style="margin: 0; color: #3b82f6; font-size: 14px; line-height: 21px;">
          ${eventDescription}
        </p>
      </div>
    `
        : ''
    }


    <h3 style="margin: 30px 0 15px 0; color: #212636; font-size: 18px; font-weight: 600;">
      📌 Información importante
    </h3>

    <ul style="margin: 0 0 30px 0; padding-left: 20px; color: #4b5563; font-size: 16px; line-height: 28px;">
      ${
        eventStartDate && eventEndDate
          ? `<li>📅 Fechas: ${formatDateRange(eventStartDate, eventEndDate)}</li>`
          : eventDate
          ? `<li>📅 Fecha: ${formatDate(eventDate)}</li>`
          : ''
      }
      ${
        hotelName
          ? `<li>📍 Lugar: ${hotelName}</li>`
          : eventLocation
          ? `<li>📍 Lugar: ${eventLocation}</li>`
          : ''
      }
      ${
        hotelAddress
          ? `<li>📍 Dirección: ${hotelAddress}</li>`
          : ''
      }
      ${
        eventStartDate
          ? `<li>⏰ Check-in: ${getFirstDayName(eventStartDate)} 8:00 AM - 8:30 AM</li>`
          : '<li>⏰ Check-in: 8:00 AM - 8:30 AM</li>'
      }
      <li>💻 Trae tu laptop y libreta para tomar notas</li>
      <li>🏨 El alojamiento NO está incluido - reserva con anticipación</li>
      <li>🍽️ Solo la cena del sábado está incluida</li>
      ${additionalAdults > 0 || additionalChildren > 0 ? '<li>👥 Tus invitados adicionales SOLO podrán asistir a la cena del sábado</li>' : ''}
      <li>✅ Este correo es tu comprobante de registro</li>
    </ul>

    ${
      eventType === 'vip_event'
        ? emailInfoBox(
            'Este es un evento VIP exclusivo con cupo limitado. ¡Felicitaciones por asegurar tu lugar!',
            'success',
          )
        : ''
    }

    ${emailDivider()}

    <div style="text-align: center;">
      <p style="margin: 0 0 10px 0; color: #6b7280; font-size: 14px;">
        ¿Necesitas hacer cambios en tu registro?
      </p>
      <p style="margin: 0; color: #6b7280; font-size: 14px;">
        Contáctanos en <a href="mailto:support@daytradedak.com" style="color: #16a34a; text-decoration: none;">support@daytradedak.com</a>
      </p>
    </div>

    <p style="margin: 30px 0 0 0; color: #4b5563; font-size: 16px; line-height: 24px; text-align: center;">
      ¡Nos vemos en el evento!<br>
      <strong style="color: #212636;">El equipo de DayTradeDak</strong>
    </p>
  `;

  return baseEmailTemplate({
    preheader: `Confirmación de registro - ${eventName}`,
    content,
  });
};

// Seminar-specific email template (for online masterclasses/seminars)
const seminarRegistrationTemplate = (data: EventRegistrationData): string => {
  const {
    firstName,
    eventName,
    eventDate,
    eventTime,
    eventTimezone,
    eventLocation,
    ticketNumber,
    isOnline,
    meetingLink,
  } = data;

  const formattedDate = eventDate ? formatDate(eventDate) : null;
  const formattedTime = eventDate ? formatTime(eventDate, eventTimezone) : eventTime;
  const timezoneLabel = getTimezoneLabel(eventTimezone);
  const isOnlineEvent = isOnline || eventLocation?.toLowerCase().includes('online') || !eventLocation;

  const content = `
    <div style="text-align: center; margin-bottom: 30px;">
      <div style="display: inline-block; width: 80px; height: 80px; background-color: #3b82f615; border-radius: 50%; text-align: center; line-height: 80px; margin-bottom: 20px;">
        <span style="font-size: 40px;">👥</span>
      </div>
      <h2 style="margin: 0 0 10px 0; color: #212636; font-size: 28px; font-weight: 600;">
        ¡Registro confirmado!
      </h2>
      <p style="margin: 0; color: #3b82f6; font-size: 18px; font-weight: 600;">
        Tu lugar está reservado para el evento
      </p>
    </div>

    <p style="margin: 0 0 20px 0; color: #4b5563; font-size: 16px; line-height: 24px;">
      Hola ${firstName},
    </p>

    <p style="margin: 0 0 30px 0; color: #4b5563; font-size: 16px; line-height: 24px;">
      ¡Excelente noticia! Tu registro para <strong style="color: #212636;">${eventName}</strong> ha sido confirmado exitosamente.
    </p>

    <div style="background: linear-gradient(135deg, #3b82f615 0%, #8b5cf615 100%); border-radius: 12px; padding: 24px; margin: 0 0 30px 0; border-left: 4px solid #3b82f6;">
      <p style="margin: 0; color: #4b5563; font-size: 16px; line-height: 24px;">
        Has asegurado tu plaza para la masterclass exclusiva:
      </p>
      <h3 style="margin: 10px 0 0 0; color: #212636; font-size: 22px; font-weight: 700;">
        ${eventName}
      </h3>
    </div>

    <div style="background-color: #1f2937; border-radius: 12px; padding: 24px; margin: 0 0 30px 0; color: white;">
      <h3 style="margin: 0 0 20px 0; color: #3b82f6; font-size: 18px; font-weight: 600;">
        📋 Detalles del Evento
      </h3>

      <table width="100%" cellpadding="0" cellspacing="0" style="font-size: 15px;">
        <tr>
          <td style="padding: 12px 0; color: #9ca3af; vertical-align: middle;">
            <span style="font-size: 18px; margin-right: 8px;">📆</span> Fecha:
          </td>
          <td style="padding: 12px 0; color: white; font-weight: 600; text-align: right;">
            ${formattedDate || 'Por confirmar'}
          </td>
        </tr>
        <tr>
          <td style="padding: 12px 0; color: #9ca3af; vertical-align: middle; border-top: 1px solid #374151;">
            <span style="font-size: 18px; margin-right: 8px;">⏰</span> Hora:
          </td>
          <td style="padding: 12px 0; color: white; font-weight: 600; text-align: right; border-top: 1px solid #374151;">
            ${formattedTime || 'Por confirmar'} (${timezoneLabel})
          </td>
        </tr>
        <tr>
          <td style="padding: 12px 0; color: #9ca3af; vertical-align: middle; border-top: 1px solid #374151;">
            <span style="font-size: 18px; margin-right: 8px;">📍</span> Modalidad:
          </td>
          <td style="padding: 12px 0; color: #3b82f6; font-weight: 600; text-align: right; border-top: 1px solid #374151;">
            ${isOnlineEvent ? '🌐 Online en Vivo' : eventLocation}
          </td>
        </tr>
        <tr>
          <td style="padding: 12px 0; color: #9ca3af; vertical-align: middle; border-top: 1px solid #374151;">
            <span style="font-size: 18px; margin-right: 8px;">🎓</span> Instructor:
          </td>
          <td style="padding: 12px 0; color: #22c55e; font-weight: 600; text-align: right; border-top: 1px solid #374151;">
            Mijail Medina
          </td>
        </tr>
        ${ticketNumber ? `
        <tr>
          <td style="padding: 12px 0; color: #9ca3af; vertical-align: middle; border-top: 1px solid #374151;">
            <span style="font-size: 18px; margin-right: 8px;">🎫</span> Ticket:
          </td>
          <td style="padding: 12px 0; color: #9ca3af; font-family: monospace; text-align: right; border-top: 1px solid #374151;">
            ${ticketNumber}
          </td>
        </tr>
        ` : ''}
      </table>
    </div>

    <h3 style="margin: 30px 0 15px 0; color: #212636; font-size: 18px; font-weight: 600;">
      🎯 En esta sesión aprenderás:
    </h3>

    <div style="margin: 0 0 30px 0;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="padding: 10px 0; vertical-align: top; width: 30px;">
            <span style="display: inline-block; width: 24px; height: 24px; background-color: #3b82f6; border-radius: 50%; color: white; text-align: center; line-height: 24px; font-size: 14px; font-weight: bold;">✓</span>
          </td>
          <td style="padding: 10px 0; padding-left: 12px; color: #4b5563; font-size: 15px;">
            <strong style="color: #212636;">Fundamentos del método de opciones S&P500</strong> - La metodología que utilizamos en DayTradeDAK
          </td>
        </tr>
        <tr>
          <td style="padding: 10px 0; vertical-align: top; width: 30px;">
            <span style="display: inline-block; width: 24px; height: 24px; background-color: #3b82f6; border-radius: 50%; color: white; text-align: center; line-height: 24px; font-size: 14px; font-weight: bold;">✓</span>
          </td>
          <td style="padding: 10px 0; padding-left: 12px; color: #4b5563; font-size: 15px;">
            <strong style="color: #212636;">Operativa diaria en directo</strong> - Junto a Mijail Medina, trader profesional
          </td>
        </tr>
        <tr>
          <td style="padding: 10px 0; vertical-align: top; width: 30px;">
            <span style="display: inline-block; width: 24px; height: 24px; background-color: #3b82f6; border-radius: 50%; color: white; text-align: center; line-height: 24px; font-size: 14px; font-weight: bold;">✓</span>
          </td>
          <td style="padding: 10px 0; padding-left: 12px; color: #4b5563; font-size: 15px;">
            <strong style="color: #212636;">Metodología diferenciada</strong> - Qué nos distingue de las estrategias genéricas
          </td>
        </tr>
        <tr>
          <td style="padding: 10px 0; vertical-align: top; width: 30px;">
            <span style="display: inline-block; width: 24px; height: 24px; background-color: #3b82f6; border-radius: 50%; color: white; text-align: center; line-height: 24px; font-size: 14px; font-weight: bold;">✓</span>
          </td>
          <td style="padding: 10px 0; padding-left: 12px; color: #4b5563; font-size: 15px;">
            <strong style="color: #212636;">Información del curso oficial</strong> - Oferta de lanzamiento exclusiva
          </td>
        </tr>
      </table>
    </div>

    <div style="background-color: #f0fdf4; border-radius: 12px; padding: 24px; margin: 0 0 30px 0; border-left: 4px solid #22c55e;">
      <p style="margin: 0 0 5px 0; color: #166534; font-size: 16px; font-weight: 600;">
        🎁 BONUS INCLUIDO
      </p>
      <p style="margin: 0; color: #15803d; font-size: 15px; line-height: 24px;">
        Tendrás <strong>acceso gratuito a la clase en vivo del día siguiente</strong> para ver la metodología aplicada en tiempo real con operaciones reales del mercado.
      </p>
    </div>

    <div style="background-color: #f0fdf4; border-radius: 12px; padding: 24px; margin: 0 0 30px 0; text-align: center;">
      <p style="margin: 0 0 15px 0; color: #166534; font-size: 16px; font-weight: 600;">
        📝 Próximos pasos
      </p>
      <ol style="margin: 0; padding-left: 20px; color: #15803d; font-size: 14px; line-height: 24px; text-align: left; display: inline-block;">
        <li>Guarda la fecha en tu calendario</li>
        <li>Prepara libreta para tomar notas</li>
        <li>Te enviaremos el enlace de acceso antes del evento</li>
        <li>Conéctate 5 minutos antes para asegurar tu lugar</li>
      </ol>
    </div>

    ${emailDivider()}

    <div style="text-align: center;">
      <p style="margin: 0 0 10px 0; color: #6b7280; font-size: 14px;">
        ¿Tienes preguntas? Contáctanos:
      </p>
      <p style="margin: 0; color: #6b7280; font-size: 14px;">
        <a href="mailto:support@daytradedak.com" style="color: #3b82f6; text-decoration: none; font-weight: 600;">support@daytradedak.com</a>
      </p>
    </div>

    <p style="margin: 30px 0 0 0; color: #4b5563; font-size: 16px; line-height: 24px; text-align: center;">
      ¡Nos vemos en la masterclass!<br>
      <strong style="color: #212636;">El equipo de DayTradeDak</strong>
    </p>

    <div style="margin-top: 30px; padding: 20px; background-color: #f3f4f6; border-radius: 8px; text-align: center;">
      <p style="margin: 0; color: #6b7280; font-size: 12px;">
        Este correo es tu confirmación de registro. Por favor, guárdalo.<br>
        ${ticketNumber ? `Número de ticket: <strong>${ticketNumber}</strong>` : ''}
      </p>
    </div>
  `;

  return baseEmailTemplate({
    preheader: `¡Confirmado! Tu plaza para ${eventName} está reservada`,
    content,
  });
};

// Helper to detect if event is an online masterclass/seminar
const isOnlineMasterclass = (data: EventRegistrationData): boolean => {
  const isOnline = data.isOnline ||
    data.eventLocation?.toLowerCase().includes('online') ||
    !data.eventLocation;

  const isMasterclassName = data.eventName?.toLowerCase().includes('masterclass') ||
    data.eventName?.toLowerCase().includes('opciones s&p') ||
    data.eventName?.toLowerCase().includes('acceso a operativa');

  return isOnline && isMasterclassName;
};

// Main export - routes to appropriate template based on event type
export const eventRegistrationTemplate = (
  data: EventRegistrationData,
): string => {
  // Use webinar template for webinar events
  if (data.eventType === 'webinar') {
    return webinarRegistrationTemplate(data);
  }

  // Use seminar template for seminar events (online masterclasses)
  if (data.eventType === 'seminar') {
    return seminarRegistrationTemplate(data);
  }

  // Also use seminar template for community_event if it's an online masterclass
  // This handles events that may be miscategorized but are actually online masterclasses
  if (data.eventType === 'community_event' && isOnlineMasterclass(data)) {
    return seminarRegistrationTemplate(data);
  }

  // Use default template for other event types (in-person events)
  return defaultEventRegistrationTemplate(data);
};
