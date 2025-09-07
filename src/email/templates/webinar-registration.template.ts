import {
  baseEmailTemplate,
  emailButton,
  emailDivider,
  emailInfoBox,
} from './base-email.template';

export interface WebinarRegistrationData {
  firstName: string;
  eventName: string;
  eventDate?: Date;
  eventTime?: string;
  webinarLink?: string;
  description?: string;
  registrationNumber?: string;
}

const formatDate = (date: Date): string => {
  return new Intl.DateTimeFormat('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
};

export const webinarRegistrationTemplate = (
  data: WebinarRegistrationData,
): string => {
  const {
    firstName,
    eventName,
    eventDate,
    eventTime,
    webinarLink,
    description,
    registrationNumber,
  } = data;

  const formattedDate = eventDate ? formatDate(eventDate) : null;

  const content = `
    <div style="text-align: center; margin-bottom: 30px;">
      <div style="display: inline-block; width: 80px; height: 80px; background-color: #3b82f615; border-radius: 50%; text-align: center; line-height: 80px; margin-bottom: 20px;">
        <span style="font-size: 40px;">💻</span>
      </div>
      <h2 style="margin: 0 0 10px 0; color: #212636; font-size: 28px; font-weight: 600;">
        ¡Registro confirmado!
      </h2>
      <p style="margin: 0; color: #6b7280; font-size: 16px;">
        Tu lugar está reservado para el webinar
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
        📋 Detalles del webinar
      </h3>
      
      <table width="100%" cellpadding="0" cellspacing="0" style="font-size: 14px;">
        <tr>
          <td style="padding: 8px 0; color: #6b7280; vertical-align: top;">Evento:</td>
          <td style="padding: 8px 0; color: #212636; font-weight: 600; text-align: right;">${eventName}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #6b7280;">Tipo:</td>
          <td style="padding: 8px 0; color: #3b82f6; font-weight: 600; text-align: right;">Webinar Gratuito</td>
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
        <tr>
          <td style="padding: 8px 0; color: #6b7280;">Modalidad:</td>
          <td style="padding: 8px 0; color: #212636; text-align: right;">Online (Zoom)</td>
        </tr>
        ${
          registrationNumber
            ? `
        <tr>
          <td style="padding: 8px 0; color: #6b7280; font-size: 12px;">ID de registro:</td>
          <td style="padding: 8px 0; color: #6b7280; text-align: right; font-size: 12px; font-family: monospace;">${registrationNumber}</td>
        </tr>
        `
            : ''
        }
      </table>
    </div>

    ${
      description
        ? `
      <div style="background-color: #eff6ff; border-radius: 8px; padding: 20px; margin: 0 0 30px 0;">
        <p style="margin: 0 0 10px 0; color: #1e40af; font-size: 16px; font-weight: 600;">
          ¿Qué aprenderás en este webinar?
        </p>
        <p style="margin: 0; color: #3b82f6; font-size: 14px; line-height: 21px;">
          ${description}
        </p>
      </div>
    `
        : ''
    }

    ${emailInfoBox(
      '💡 El enlace de acceso al webinar será enviado 30 minutos antes del evento a este mismo correo.',
      'info',
    )}

    <h3 style="margin: 30px 0 15px 0; color: #212636; font-size: 18px; font-weight: 600;">
      ✅ Preparación para el webinar
    </h3>

    <ul style="margin: 0 0 30px 0; padding-left: 20px; color: #4b5563; font-size: 16px; line-height: 28px;">
      <li>🖥️ Asegúrate de tener una conexión estable a internet</li>
      <li>🎧 Prepara tus audífonos o altavoces para mejor audio</li>
      <li>📝 Ten a mano libreta y lápiz para tomar notas</li>
      <li>⏰ Conéctate 5 minutos antes para probar tu audio y video</li>
      <li>💬 Prepara tus preguntas para la sesión de Q&A</li>
      <li>📧 Revisa tu correo 30 minutos antes del evento</li>
    </ul>

    <div style="background-color: #10b98115; border-left: 4px solid #10b981; padding: 16px; margin: 0 0 30px 0;">
      <p style="margin: 0; color: #047857; font-size: 14px; font-weight: 600;">
        🎁 Bonus Exclusivo
      </p>
      <p style="margin: 8px 0 0 0; color: #059669; font-size: 14px; line-height: 21px;">
        Los asistentes al webinar recibirán material educativo exclusivo y acceso a ofertas especiales solo disponibles durante el evento en vivo.
      </p>
    </div>

    ${emailDivider()}

    <div style="text-align: center;">
      <p style="margin: 0 0 10px 0; color: #6b7280; font-size: 14px;">
        ¿Tienes preguntas sobre el webinar?
      </p>
      <p style="margin: 0; color: #6b7280; font-size: 14px;">
        Contáctanos en <a href="mailto:support@daytradedak.com" style="color: #3b82f6; text-decoration: none;">support@daytradedak.com</a>
      </p>
    </div>

    <p style="margin: 30px 0 0 0; color: #4b5563; font-size: 16px; line-height: 24px; text-align: center;">
      ¡Nos vemos en el webinar!<br>
      <strong style="color: #212636;">El equipo de DayTradeDak Academy</strong>
    </p>
  `;

  return baseEmailTemplate({
    preheader: `Confirmación de registro - ${eventName}`,
    content,
  });
};