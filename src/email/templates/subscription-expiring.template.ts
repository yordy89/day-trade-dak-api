import {
  baseEmailTemplate,
  emailButton,
  emailInfoBox,
} from './base-email.template';

export interface SubscriptionExpiringData {
  firstName: string;
  planName: string;
  expirationDate: Date;
  daysRemaining: number;
}

const formatDate = (date: Date): string => {
  return new Intl.DateTimeFormat('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
};

const getUrgencyMessage = (
  daysRemaining: number,
): { title: string; emoji: string; color: string } => {
  if (daysRemaining <= 1) {
    return {
      title: '¡Tu suscripción expira mañana!',
      emoji: '⏰',
      color: '#ef4444', // red
    };
  } else if (daysRemaining <= 3) {
    return {
      title: 'Tu suscripción expira pronto',
      emoji: '⚠️',
      color: '#f59e0b', // amber
    };
  } else {
    return {
      title: 'Recordatorio de renovación',
      emoji: '📅',
      color: '#3b82f6', // blue
    };
  }
};

export const subscriptionExpiringTemplate = (
  data: SubscriptionExpiringData,
): string => {
  const { firstName, planName, expirationDate, daysRemaining } = data;
  const { title, emoji, color } = getUrgencyMessage(daysRemaining);
  const formattedDate = formatDate(expirationDate);

  const content = `
    <div style="text-align: center; margin-bottom: 30px;">
      <div style="display: inline-block; width: 80px; height: 80px; background-color: ${color}15; border-radius: 50%; text-align: center; line-height: 80px; margin-bottom: 20px;">
        <span style="font-size: 40px;">${emoji}</span>
      </div>
      <h2 style="margin: 0 0 10px 0; color: #212636; font-size: 28px; font-weight: 600;">
        ${title}
      </h2>
      <p style="margin: 0; color: ${color}; font-size: 18px; font-weight: 600;">
        ${daysRemaining === 1 ? '1 día restante' : `${daysRemaining} días restantes`}
      </p>
    </div>

    <p style="margin: 0 0 20px 0; color: #4b5563; font-size: 16px; line-height: 24px;">
      Hola ${firstName},
    </p>

    <p style="margin: 0 0 30px 0; color: #4b5563; font-size: 16px; line-height: 24px;">
      Te escribimos para recordarte que tu suscripción <strong style="color: #212636;">${planName}</strong> 
      está próxima a expirar.
    </p>

    <div style="background-color: #f9fafb; border-radius: 8px; padding: 24px; margin: 0 0 30px 0; text-align: center;">
      <p style="margin: 0 0 10px 0; color: #6b7280; font-size: 14px;">
        Fecha de expiración:
      </p>
      <p style="margin: 0; color: #212636; font-size: 20px; font-weight: 600;">
        ${formattedDate}
      </p>
    </div>

    ${
      daysRemaining <= 1
        ? emailInfoBox(
            '¡No pierdas acceso! Renueva ahora para continuar disfrutando de todos los beneficios sin interrupciones.',
            'warning',
          )
        : ''
    }

    <h3 style="margin: 30px 0 15px 0; color: #212636; font-size: 18px; font-weight: 600;">
      🎯 No te pierdas:
    </h3>

    <ul style="margin: 0 0 30px 0; padding-left: 20px; color: #4b5563; font-size: 16px; line-height: 28px;">
      ${
        planName.includes('Live')
          ? `
        <li>Sesiones de trading en vivo diarias</li>
        <li>Análisis del mercado en tiempo real</li>
        <li>Interacción directa con traders profesionales</li>
      `
          : ''
      }
      ${
        planName.includes('Master')
          ? `
        <li>Master clases semanales exclusivas</li>
        <li>Estrategias avanzadas de trading</li>
        <li>Material de estudio premium</li>
      `
          : ''
      }
      ${
        planName.includes('Clases')
          ? `
        <li>Acceso completo al curso estructurado</li>
        <li>Más de 40 horas de contenido educativo</li>
        <li>Certificado de finalización</li>
      `
          : ''
      }
      <li>Soporte continuo de nuestro equipo</li>
      <li>Acceso a la comunidad exclusiva de traders</li>
    </ul>

    ${emailButton('Renovar mi suscripción', `${process.env.FRONTEND_URL}/academy/subscription/plans`)}

    ${
      planName.includes('Weekly Manual')
        ? `
      <div style="background-color: #eff6ff; border-radius: 8px; padding: 20px; margin: 30px 0;">
        <p style="margin: 0 0 10px 0; color: #1e40af; font-size: 16px; font-weight: 600;">
          💡 ¿Sabías que puedes ahorrar?
        </p>
        <p style="margin: 0; color: #3b82f6; font-size: 14px; line-height: 21px;">
          Cambia a nuestra suscripción semanal automática y ahorra un 10% en cada renovación. 
          Además, nunca tendrás que preocuparte por perder el acceso.
        </p>
      </div>
    `
        : ''
    }

    <p style="margin: 30px 0 0 0; color: #6b7280; font-size: 14px; line-height: 21px; text-align: center;">
      Si decides no renovar, perderás el acceso a tu plan el ${formattedDate}.<br>
      Siempre podrás volver cuando lo desees, ¡te estaremos esperando!
    </p>

    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">

    <p style="margin: 0; color: #6b7280; font-size: 14px; line-height: 21px; text-align: center;">
      ¿Tienes preguntas sobre tu suscripción?<br>
      Contáctanos en <a href="mailto:support@daytradedak.com" style="color: #16a34a; text-decoration: none;">support@daytradedak.com</a>
    </p>
  `;

  return baseEmailTemplate({
    preheader: `Tu suscripción ${planName} expira en ${daysRemaining} ${daysRemaining === 1 ? 'día' : 'días'}`,
    content,
  });
};
