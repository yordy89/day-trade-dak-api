import {
  baseEmailTemplate,
  emailButton,
  emailDivider,
  emailInfoBox,
} from './base-email.template';

export interface EventRegistrationData {
  firstName: string;
  eventName: string;
  eventType: 'master_course' | 'community_event' | 'vip_event';
  eventDate?: Date;
  eventTime?: string;
  eventLocation?: string;
  eventDescription?: string;
  ticketNumber?: string;
  isPaid: boolean;
  amount?: number;
  currency?: string;
}

const formatDate = (date: Date): string => {
  return new Intl.DateTimeFormat('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
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
  };

  return types[eventType] || types.community_event;
};

export const eventRegistrationTemplate = (
  data: EventRegistrationData,
): string => {
  const {
    firstName,
    eventName,
    eventType,
    eventDate,
    eventTime,
    eventLocation,
    eventDescription,
    ticketNumber,
    isPaid,
    amount,
    currency,
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

    ${emailButton('Ver detalles del evento', `${process.env.FRONTEND_URL}/events/${eventType}`)}

    <h3 style="margin: 30px 0 15px 0; color: #212636; font-size: 18px; font-weight: 600;">
      📌 Información importante
    </h3>

    <ul style="margin: 0 0 30px 0; padding-left: 20px; color: #4b5563; font-size: 16px; line-height: 28px;">
      ${eventDate ? '<li>Guarda la fecha en tu calendario</li>' : ''}
      ${
        eventLocation && eventLocation.includes('online')
          ? '<li>El enlace de acceso se enviará 24 horas antes del evento</li>'
          : eventLocation
            ? '<li>Llega con 15 minutos de anticipación</li>'
            : ''
      }
      <li>Prepara tus preguntas para la sesión de Q&A</li>
      <li>Comparte este evento con otros traders interesados</li>
      ${ticketNumber ? '<li>Guarda este correo como comprobante de registro</li>' : ''}
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
        Contáctanos en <a href="mailto:events@daytradedak.com" style="color: #16a34a; text-decoration: none;">events@daytradedak.com</a>
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
