import {
  baseEmailTemplate,
  emailButton,
  emailDivider,
  emailInfoBox,
} from './base-email.template';

export interface PaymentConfirmationData {
  firstName: string;
  planName: string;
  amount: number;
  currency: string;
  billingCycle?: string;
  transactionId: string;
  nextBillingDate?: Date;
  expiresAt?: Date;
  isRecurring: boolean;
}

const getPlanDescription = (planName: string): string => {
  const descriptions: Record<string, string> = {
    'Live Semanal': 'Acceso semanal a sesiones de trading en vivo',
    'Live Semanal Auto': 'Acceso semanal con renovación automática',
    'Master Clases': 'Clases magistrales de trading profesional',
    'Live Grabados': 'Biblioteca completa de sesiones grabadas',
    PsicoTrading: 'Programa de psicología del trading',
    Clases: 'Curso intensivo de trading de 15 días',
    'Paz con el Dinero': 'Curso completo de educación financiera',
    'Master Course': 'Curso maestro de trading avanzado',
    'Community Event': 'Evento especial de la comunidad',
    'VIP Event': 'Evento VIP exclusivo',
  };

  return descriptions[planName] || planName;
};

const formatCurrency = (amount: number, currency: string): string => {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: currency.toUpperCase(),
    minimumFractionDigits: 2,
  }).format(amount);
};

const formatDate = (date: Date): string => {
  return new Intl.DateTimeFormat('es-ES', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
};

export const paymentConfirmationTemplate = (
  data: PaymentConfirmationData,
): string => {
  const {
    firstName,
    planName,
    amount,
    currency,
    billingCycle,
    transactionId,
    nextBillingDate,
    expiresAt,
    isRecurring,
  } = data;

  const formattedAmount = formatCurrency(amount, currency);
  const planDescription = getPlanDescription(planName);

  const content = `
    <div style="text-align: center; margin-bottom: 30px;">
      <div style="display: inline-block; width: 80px; height: 80px; background-color: #f0fdf4; border-radius: 50%; text-align: center; line-height: 80px; margin-bottom: 20px;">
        <span style="font-size: 40px;">✅</span>
      </div>
      <h2 style="margin: 0 0 10px 0; color: #212636; font-size: 28px; font-weight: 600;">
        ¡Pago confirmado!
      </h2>
      <p style="margin: 0; color: #6b7280; font-size: 16px;">
        Tu transacción se ha procesado exitosamente
      </p>
    </div>

    <p style="margin: 0 0 20px 0; color: #4b5563; font-size: 16px; line-height: 24px;">
      Hola ${firstName},
    </p>

    <p style="margin: 0 0 30px 0; color: #4b5563; font-size: 16px; line-height: 24px;">
      Te confirmamos que hemos recibido tu pago correctamente. A continuación encontrarás los detalles de tu transacción:
    </p>

    <div style="background-color: #f9fafb; border-radius: 8px; padding: 24px; margin: 0 0 30px 0;">
      <h3 style="margin: 0 0 20px 0; color: #212636; font-size: 18px; font-weight: 600;">
        Detalles de la transacción
      </h3>
      
      <table width="100%" cellpadding="0" cellspacing="0" style="font-size: 14px;">
        <tr>
          <td style="padding: 8px 0; color: #6b7280;">Plan contratado:</td>
          <td style="padding: 8px 0; color: #212636; font-weight: 600; text-align: right;">${planName}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #6b7280;">Descripción:</td>
          <td style="padding: 8px 0; color: #212636; text-align: right;">${planDescription}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #6b7280;">Monto pagado:</td>
          <td style="padding: 8px 0; color: #212636; font-weight: 600; text-align: right; font-size: 18px;">${formattedAmount}</td>
        </tr>
        ${
          billingCycle
            ? `
        <tr>
          <td style="padding: 8px 0; color: #6b7280;">Ciclo de facturación:</td>
          <td style="padding: 8px 0; color: #212636; text-align: right;">
            ${billingCycle === 'weekly' ? 'Semanal' : billingCycle === 'monthly' ? 'Mensual' : 'Pago único'}
          </td>
        </tr>
        `
            : ''
        }
        ${
          nextBillingDate && isRecurring
            ? `
        <tr>
          <td style="padding: 8px 0; color: #6b7280;">Próximo cargo:</td>
          <td style="padding: 8px 0; color: #212636; text-align: right;">${formatDate(nextBillingDate)}</td>
        </tr>
        `
            : ''
        }
        ${
          expiresAt && !isRecurring
            ? `
        <tr>
          <td style="padding: 8px 0; color: #6b7280;">Acceso hasta:</td>
          <td style="padding: 8px 0; color: #212636; text-align: right;">${formatDate(expiresAt)}</td>
        </tr>
        `
            : ''
        }
        <tr>
          <td colspan="2" style="padding-top: 16px; border-top: 1px solid #e5e7eb;"></td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #6b7280; font-size: 12px;">ID de transacción:</td>
          <td style="padding: 8px 0; color: #6b7280; text-align: right; font-size: 12px; font-family: monospace;">${transactionId}</td>
        </tr>
      </table>
    </div>

    ${
      isRecurring
        ? emailInfoBox(
            'Esta es una suscripción recurrente. Se renovará automáticamente al finalizar el período actual. Puedes cancelar en cualquier momento desde tu cuenta.',
            'info',
          )
        : ''
    }

    ${emailButton('Acceder a mi cuenta', `${process.env.FRONTEND_URL}/academy`)}

    <h3 style="margin: 30px 0 15px 0; color: #212636; font-size: 18px; font-weight: 600;">
      ¿Qué sigue ahora?
    </h3>

    <p style="margin: 0 0 20px 0; color: #4b5563; font-size: 16px; line-height: 24px;">
      Ya tienes acceso completo a tu plan. Te recomendamos:
    </p>

    <ul style="margin: 0 0 20px 0; padding-left: 20px; color: #4b5563; font-size: 16px; line-height: 28px;">
      ${planName.includes('Live') ? '<li>Únete a las sesiones en vivo de lunes a viernes a las 8:45 AM EST</li>' : ''}
      ${planName.includes('Clases') || planName.includes('Master') ? '<li>Comienza con el primer módulo del curso</li>' : ''}
      ${planName.includes('Psico') ? '<li>Realiza tu primera evaluación de perfil psicológico</li>' : ''}
      <li>Explora todo el contenido disponible en tu plan</li>
      <li>Conéctate con otros miembros de la comunidad</li>
    </ul>

    ${emailDivider()}

    <p style="margin: 0 0 10px 0; color: #6b7280; font-size: 14px; line-height: 21px; text-align: center;">
      <strong>¿Necesitas ayuda?</strong>
    </p>
    <p style="margin: 0; color: #6b7280; font-size: 14px; line-height: 21px; text-align: center;">
      Si tienes alguna pregunta sobre tu compra o necesitas asistencia,<br>
      no dudes en contactarnos en <a href="mailto:support@daytradedak.com" style="color: #16a34a; text-decoration: none;">support@daytradedak.com</a>
    </p>
  `;

  return baseEmailTemplate({
    preheader: `Confirmación de pago - ${planName} - ${formattedAmount}`,
    content,
  });
};
