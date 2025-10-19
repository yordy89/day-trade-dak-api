import {
  baseEmailTemplate,
  emailButton,
  emailDivider,
  emailInfoBox,
} from './base-email.template';

export interface PartialPaymentData {
  firstName: string;
  eventName: string;
  paymentType: 'deposit' | 'installment' | 'final';
  amount: number;
  currency: string;
  totalAmount: number;
  totalPaid: number;
  remainingBalance: number;
  transactionId: string;
  registrationId: string;
  isFullyPaid: boolean;
  eventDate?: string;
  eventStartDate?: Date;
  eventEndDate?: Date;
  nextPaymentDue?: Date;
}

const formatCurrency = (amount: number, currency: string): string => {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: currency.toUpperCase(),
    minimumFractionDigits: 2,
  }).format(amount);
};

const formatDate = (date: Date | string): string => {
  return new Intl.DateTimeFormat('es-ES', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(date));
};

const getPaymentTypeTitle = (paymentType: string): string => {
  const titles: Record<string, string> = {
    deposit: '¡Depósito confirmado!',
    installment: '¡Pago parcial confirmado!',
    final: '¡Pago final confirmado!',
  };
  return titles[paymentType] || '¡Pago confirmado!';
};

const getPaymentTypeMessage = (paymentType: string): string => {
  const messages: Record<string, string> = {
    deposit: 'Tu depósito ha sido procesado exitosamente. Tu registro está ahora confirmado.',
    installment: 'Tu pago parcial ha sido procesado exitosamente.',
    final: 'Tu pago final ha sido completado. ¡Ya estás listo para el evento!',
  };
  return messages[paymentType] || 'Tu pago ha sido procesado exitosamente.';
};

export const partialPaymentConfirmationTemplate = (
  data: PartialPaymentData,
): string => {
  const {
    firstName,
    eventName,
    paymentType,
    amount,
    currency,
    totalAmount,
    totalPaid,
    remainingBalance,
    transactionId,
    registrationId,
    isFullyPaid,
    eventDate,
    eventStartDate,
    eventEndDate,
    nextPaymentDue,
  } = data;

  const formattedAmount = formatCurrency(amount, currency);
  const formattedTotalAmount = formatCurrency(totalAmount, currency);
  const formattedTotalPaid = formatCurrency(totalPaid, currency);
  const formattedRemainingBalance = formatCurrency(remainingBalance, currency);
  const paymentProgress = (totalPaid / totalAmount) * 100;

  // Format event dates if available
  const formattedEventStartDate = eventStartDate ? formatDate(eventStartDate) : '26 de septiembre 2025';
  const formattedEventEndDate = eventEndDate ? formatDate(eventEndDate) : '13 de diciembre 2025';
  const formattedPresentialDates = eventStartDate && eventEndDate
    ? `${new Date(eventStartDate).getDate()}-${new Date(eventEndDate).getDate()} de ${formatDate(eventStartDate).split(' ')[2]} ${new Date(eventStartDate).getFullYear()}`
    : '11-13 de octubre 2025';

  const content = `
    <div style="text-align: center; margin-bottom: 30px;">
      <div style="display: inline-block; width: 80px; height: 80px; background-color: ${isFullyPaid ? '#f0fdf4' : '#fef3c7'}; border-radius: 50%; text-align: center; line-height: 80px; margin-bottom: 20px;">
        <span style="font-size: 40px;">${isFullyPaid ? '✅' : '💰'}</span>
      </div>
      <h2 style="margin: 0 0 10px 0; color: #212636; font-size: 28px; font-weight: 600;">
        ${getPaymentTypeTitle(paymentType)}
      </h2>
      <p style="margin: 0; color: #6b7280; font-size: 16px;">
        ${getPaymentTypeMessage(paymentType)}
      </p>
    </div>

    <p style="margin: 0 0 20px 0; color: #4b5563; font-size: 16px; line-height: 24px;">
      Hola ${firstName},
    </p>

    <p style="margin: 0 0 30px 0; color: #4b5563; font-size: 16px; line-height: 24px;">
      Te confirmamos que hemos recibido tu pago de <strong>${formattedAmount}</strong> para tu registro al evento <strong>${eventName}</strong>. A continuación encontrarás los detalles:
    </p>

    <!-- Payment Details -->
    <div style="background-color: #f9fafb; border-radius: 8px; padding: 24px; margin: 0 0 30px 0;">
      <h3 style="margin: 0 0 20px 0; color: #212636; font-size: 18px; font-weight: 600;">
        Detalles del pago
      </h3>

      <table width="100%" cellpadding="0" cellspacing="0" style="font-size: 14px;">
        <tr>
          <td style="padding: 8px 0; color: #6b7280;">Evento:</td>
          <td style="padding: 8px 0; color: #212636; font-weight: 600; text-align: right;">${eventName}</td>
        </tr>
        ${
          eventDate
            ? `
        <tr>
          <td style="padding: 8px 0; color: #6b7280;">Fecha del evento:</td>
          <td style="padding: 8px 0; color: #212636; text-align: right;">${formatDate(eventDate)}</td>
        </tr>
        `
            : ''
        }
        <tr>
          <td style="padding: 8px 0; color: #6b7280;">Monto de este pago:</td>
          <td style="padding: 8px 0; color: #212636; font-weight: 600; text-align: right; font-size: 18px;">${formattedAmount}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #6b7280;">Tipo de pago:</td>
          <td style="padding: 8px 0; color: #212636; text-align: right;">
            ${paymentType === 'deposit' ? 'Depósito inicial' : paymentType === 'installment' ? 'Pago parcial' : 'Pago final'}
          </td>
        </tr>
        <tr>
          <td colspan="2" style="padding-top: 16px; border-top: 1px solid #e5e7eb;"></td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #6b7280;">Número de registro:</td>
          <td style="padding: 8px 0; color: #212636; text-align: right; font-family: monospace; font-weight: 600;">${registrationId}</td>
        </tr>
      </table>
    </div>

    <!-- Payment Progress -->
    <div style="background-color: ${isFullyPaid ? '#f0fdf4' : '#fef3c7'}; border-radius: 8px; padding: 24px; margin: 0 0 30px 0; border: 2px solid ${isFullyPaid ? '#16a34a' : '#f59e0b'};">
      <h3 style="margin: 0 0 15px 0; color: #212636; font-size: 18px; font-weight: 600;">
        Resumen del pago total
      </h3>

      <!-- Progress Bar -->
      <div style="width: 100%; height: 24px; background-color: white; border-radius: 12px; overflow: hidden; margin-bottom: 15px;">
        <div style="width: ${paymentProgress}%; height: 100%; background: linear-gradient(90deg, ${isFullyPaid ? '#16a34a, #15803d' : '#f59e0b, #ea580c'}); display: flex; align-items: center; justify-content: flex-end; padding-right: 10px;">
          <span style="color: white; font-size: 12px; font-weight: 600;">${paymentProgress.toFixed(0)}%</span>
        </div>
      </div>

      <table width="100%" cellpadding="0" cellspacing="0" style="font-size: 14px;">
        <tr>
          <td style="padding: 8px 0; color: #4b5563;">Precio total del evento:</td>
          <td style="padding: 8px 0; color: #212636; font-weight: 600; text-align: right;">${formattedTotalAmount}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #4b5563;">Total pagado:</td>
          <td style="padding: 8px 0; color: ${isFullyPaid ? '#16a34a' : '#f59e0b'}; font-weight: 600; text-align: right;">${formattedTotalPaid}</td>
        </tr>
        <tr>
          <td style="padding: 12px 0 8px 0; color: #212636; font-weight: 600; border-top: 2px solid ${isFullyPaid ? '#16a34a' : '#f59e0b'};">Saldo pendiente:</td>
          <td style="padding: 12px 0 8px 0; color: ${isFullyPaid ? '#16a34a' : '#f59e0b'}; font-weight: 700; text-align: right; font-size: 20px; border-top: 2px solid ${isFullyPaid ? '#16a34a' : '#f59e0b'};">
            ${isFullyPaid ? '¡Completado!' : formattedRemainingBalance}
          </td>
        </tr>
      </table>
    </div>

    ${
      !isFullyPaid
        ? emailInfoBox(
            `Te recordamos que tienes un saldo pendiente de <strong>${formattedRemainingBalance}</strong>. Puedes realizar pagos adicionales en cualquier momento antes del evento.${nextPaymentDue ? `<br><br>Próximo pago sugerido: ${formatDate(nextPaymentDue)}` : ''}`,
            'warning',
          )
        : emailInfoBox(
            '¡Felicidades! Has completado el pago total de tu registro. Estás listo para disfrutar del evento.',
            'success',
          )
    }

    ${emailButton(
      isFullyPaid ? 'Ver mi registro' : 'Realizar otro pago',
      `${process.env.FRONTEND_URL}/master-course/my-registration`,
    )}

    <h3 style="margin: 30px 0 15px 0; color: #212636; font-size: 18px; font-weight: 600;">
      ${isFullyPaid ? '¡Tu lugar está asegurado!' : '¿Cómo realizar pagos adicionales?'}
    </h3>

    ${
      !isFullyPaid
        ? `
    <p style="margin: 0 0 20px 0; color: #4b5563; font-size: 16px; line-height: 24px;">
      Para completar tu pago y asegurar tu acceso completo al curso:
    </p>

    <ul style="margin: 0 0 20px 0; padding-left: 20px; color: #4b5563; font-size: 16px; line-height: 28px;">
      <li>Visita la página <strong>"Mi Registro"</strong> usando el botón de arriba</li>
      <li>Busca tu registro con tu email o número de registro</li>
      <li>Selecciona el monto que deseas pagar</li>
      <li>Completa el pago de forma segura</li>
    </ul>

    <p style="margin: 20px 0; padding: 15px; background-color: #fef3c7; border-left: 4px solid #f59e0b; border-radius: 4px; color: #92400e; font-size: 14px; line-height: 22px;">
      <strong>📌 Importante:</strong> Recibirás las credenciales de acceso a la plataforma <strong>2 semanas antes del evento presencial</strong> (finales de septiembre 2025), una vez que tu pago esté completo.
    </p>
    `
        : `
    <p style="margin: 0 0 20px 0; color: #4b5563; font-size: 16px; line-height: 24px;">
      ¡Felicidades! Tu inscripción al Master Trading Course está completa. Aquí te indicamos qué esperar:
    </p>

    <ul style="margin: 0 0 20px 0; padding-left: 20px; color: #4b5563; font-size: 16px; line-height: 28px;">
      <li><strong>2 semanas antes del evento:</strong> Recibirás las credenciales de acceso a la plataforma online</li>
      <li><strong>${formattedEventStartDate}:</strong> Inicio del curso online (primera sesión a las 7:00 PM EST)</li>
      <li><strong>${formattedPresentialDates}:</strong> Evento presencial en Tampa, Florida</li>
      <li>Te enviaremos recordatorios y detalles adicionales conforme se acerque la fecha</li>
    </ul>

    <p style="margin: 20px 0; padding: 15px; background-color: #f0fdf4; border-left: 4px solid #16a34a; border-radius: 4px; color: #065f46; font-size: 14px; line-height: 22px;">
      <strong>✅ Tu lugar está garantizado.</strong> Guarda este email como comprobante de tu registro.
    </p>
    `
    }

    ${emailDivider()}

    <p style="margin: 0 0 10px 0; color: #6b7280; font-size: 14px; line-height: 21px; text-align: center;">
      <strong>¿Necesitas ayuda?</strong>
    </p>
    <p style="margin: 0; color: #6b7280; font-size: 14px; line-height: 21px; text-align: center;">
      Si tienes alguna pregunta sobre tu pago o registro,<br>
      no dudes en contactarnos en <a href="mailto:support@daytradedak.com" style="color: #16a34a; text-decoration: none;">support@daytradedak.com</a>
    </p>
  `;

  return baseEmailTemplate({
    preheader: `${paymentType === 'deposit' ? 'Depósito' : 'Pago'} confirmado - ${eventName} - ${formattedAmount}`,
    content,
  });
};
