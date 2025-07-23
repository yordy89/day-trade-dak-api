export interface AdditionalAttendeesData {
  firstName: string;
  eventName: string;
  eventDate?: Date;
  confirmationNumber: string;
  additionalAdults: number;
  additionalChildren: number;
  adultPrice: number;
  childPrice: number;
  adultsSubtotal: number;
  childrenSubtotal: number;
  klarnaFee?: number;
  totalAmount: number;
  paymentMethod: 'card' | 'klarna';
  manageRegistrationUrl: string;
}

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(amount);
};

const formatDate = (date: Date): string => {
  return new Intl.DateTimeFormat('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
};

export const additionalAttendeesTemplate = (data: AdditionalAttendeesData): string => {
  const {
    firstName,
    eventName,
    eventDate,
    confirmationNumber,
    additionalAdults,
    additionalChildren,
    adultPrice,
    childPrice,
    adultsSubtotal,
    childrenSubtotal,
    klarnaFee,
    totalAmount,
    paymentMethod,
    manageRegistrationUrl,
  } = data;

  const formattedDate = eventDate ? formatDate(eventDate) : '';

  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Confirmación - Invitados Adicionales</title>
  <style>
    body { margin: 0; padding: 0; background-color: #f5f5f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; }
    table { border-collapse: collapse !important; }
    @media screen and (max-width: 600px) {
      .container { width: 100% !important; }
      .mobile-padding { padding: 20px !important; }
      .mobile-center { text-align: center !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #0a0a0a;">
  
  <!-- Email container -->
  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #0a0a0a; padding: 20px 0;">
    <tr>
      <td align="center">
        <table class="container" border="0" cellpadding="0" cellspacing="0" width="600" style="background-color: #000000; border-radius: 12px; overflow: hidden; box-shadow: 0 20px 50px rgba(0,0,0,0.5);">
          
          <!-- Header with gradient -->
          <tr>
            <td style="position: relative; background: linear-gradient(135deg, rgba(10,10,10,0.92) 0%, rgba(22,163,74,0.85) 30%, rgba(153,27,27,0.85) 70%, rgba(10,10,10,0.92) 100%); padding: 50px 40px; text-align: center;">
              <h1 style="margin: 0 0 10px 0; color: #ffffff; font-size: 32px; font-weight: 700; text-shadow: 2px 2px 4px rgba(0,0,0,0.5);">
                ¡Invitados Adicionales Confirmados!
              </h1>
              <p style="margin: 0; color: rgba(255,255,255,0.9); font-size: 18px; text-shadow: 1px 1px 3px rgba(0,0,0,0.5);">
                Tu pago ha sido procesado exitosamente
              </p>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td class="mobile-padding" style="padding: 40px; background-color: #000000;">
              
              <!-- Greeting -->
              <p style="font-size: 20px; font-weight: 600; margin: 0 0 20px 0; color: #ffffff;">
                Hola ${firstName},
              </p>
              
              <p style="font-size: 16px; line-height: 1.8; color: rgba(255,255,255,0.9); margin: 0 0 30px 0;">
                Te confirmamos que hemos recibido tu pago y los invitados adicionales han sido agregados correctamente a tu registro para el evento.
              </p>
              
              <!-- Event Info Box -->
              <div style="background-color: rgba(34,197,94,0.1); border: 1px solid rgba(34,197,94,0.2); border-radius: 8px; padding: 25px; margin-bottom: 30px;">
                <h2 style="font-size: 20px; font-weight: 700; color: #22c55e; margin: 0 0 15px 0;">
                  ${eventName}
                </h2>
                ${eventDate ? `
                <div style="padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.1);">
                  <span style="font-weight: 500; color: rgba(255,255,255,0.6); text-transform: uppercase; font-size: 12px; letter-spacing: 0.5px;">
                    FECHA DEL EVENTO
                  </span>
                  <div style="font-weight: 600; color: #ffffff; margin-top: 5px;">
                    ${formattedDate}
                  </div>
                </div>
                ` : ''}
                <div style="padding: 10px 0;">
                  <span style="font-weight: 500; color: rgba(255,255,255,0.6); text-transform: uppercase; font-size: 12px; letter-spacing: 0.5px;">
                    NÚMERO DE CONFIRMACIÓN
                  </span>
                  <div style="font-weight: 600; color: #ffffff; margin-top: 5px;">
                    ${confirmationNumber}
                  </div>
                </div>
              </div>
              
              <!-- Attendees Summary -->
              <div style="background-color: rgba(34,197,94,0.1); border: 1px solid rgba(34,197,94,0.2); border-radius: 8px; padding: 25px; margin-bottom: 30px;">
                <h3 style="font-size: 16px; font-weight: 600; color: rgba(255,255,255,0.8); margin: 0 0 15px 0; text-transform: uppercase; letter-spacing: 0.5px;">
                  INVITADOS ADICIONALES
                </h3>
                
                ${additionalAdults > 0 ? `
                <table cellpadding="0" cellspacing="0" border="0" width="100%" style="padding: 12px 0; border-bottom: 1px solid rgba(255,255,255,0.08);">
                  <tr>
                    <td width="40" style="vertical-align: middle;">
                      <div style="width: 40px; height: 40px; background-color: rgba(255,255,255,0.1); border-radius: 50%; text-align: center; line-height: 40px;">
                        <span style="font-size: 20px;">👤</span>
                      </div>
                    </td>
                    <td style="padding-left: 15px; vertical-align: middle;">
                      <div style="font-weight: 600; color: #ffffff; font-size: 16px;">Adultos</div>
                      <div style="font-size: 14px; color: rgba(255,255,255,0.6);">${formatCurrency(adultPrice)} por adulto</div>
                    </td>
                    <td width="50" style="text-align: right; vertical-align: middle;">
                      <div style="font-size: 24px; font-weight: 700; color: #22c55e;">${additionalAdults}</div>
                    </td>
                  </tr>
                </table>
                ` : ''}
                
                ${additionalChildren > 0 ? `
                <table cellpadding="0" cellspacing="0" border="0" width="100%" style="padding: 12px 0;">
                  <tr>
                    <td width="40" style="vertical-align: middle;">
                      <div style="width: 40px; height: 40px; background-color: rgba(255,255,255,0.1); border-radius: 50%; text-align: center; line-height: 40px;">
                        <span style="font-size: 20px;">👶</span>
                      </div>
                    </td>
                    <td style="padding-left: 15px; vertical-align: middle;">
                      <div style="font-weight: 600; color: #ffffff; font-size: 16px;">Niños</div>
                      <div style="font-size: 14px; color: rgba(255,255,255,0.6);">${formatCurrency(childPrice)} por niño (menor de 12)</div>
                    </td>
                    <td width="50" style="text-align: right; vertical-align: middle;">
                      <div style="font-size: 24px; font-weight: 700; color: #22c55e;">${additionalChildren}</div>
                    </td>
                  </tr>
                </table>
                ` : ''}
              </div>
              
              <!-- Payment Summary -->
              <div style="background-color: rgba(34,197,94,0.1); border: 1px solid rgba(34,197,94,0.2); border-radius: 8px; padding: 25px; margin-bottom: 30px;">
                <h3 style="font-size: 16px; font-weight: 600; color: rgba(255,255,255,0.8); margin: 0 0 15px 0; text-transform: uppercase; letter-spacing: 0.5px;">
                  RESUMEN DE PAGO
                </h3>
                
                ${additionalAdults > 0 ? `
                <table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom: 10px;">
                  <tr>
                    <td style="color: rgba(255,255,255,0.6); font-size: 14px; padding: 8px 0;">${additionalAdults} Adulto${additionalAdults > 1 ? 's' : ''}</td>
                    <td style="color: rgba(255,255,255,0.8); font-weight: 500; text-align: right; padding: 8px 0;">${formatCurrency(adultsSubtotal)}</td>
                  </tr>
                </table>
                ` : ''}
                
                ${additionalChildren > 0 ? `
                <table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom: 10px;">
                  <tr>
                    <td style="color: rgba(255,255,255,0.6); font-size: 14px; padding: 8px 0;">${additionalChildren} Niño${additionalChildren > 1 ? 's' : ''}</td>
                    <td style="color: rgba(255,255,255,0.8); font-weight: 500; text-align: right; padding: 8px 0;">${formatCurrency(childrenSubtotal)}</td>
                  </tr>
                </table>
                ` : ''}
                
                ${klarnaFee && klarnaFee > 0 ? `
                <table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom: 10px;">
                  <tr>
                    <td style="color: rgba(255,255,255,0.6); font-size: 14px; padding: 8px 0;">Comisión Klarna (6.44%)</td>
                    <td style="color: rgba(255,255,255,0.8); font-weight: 500; text-align: right; padding: 8px 0;">${formatCurrency(klarnaFee)}</td>
                  </tr>
                </table>
                ` : ''}
                
                <table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top: 15px; padding-top: 15px; border-top: 1px solid rgba(255,255,255,0.1);">
                  <tr>
                    <td style="font-size: 18px; font-weight: 700; color: #ffffff;">Total Pagado</td>
                    <td style="font-size: 24px; font-weight: 700; color: #22c55e; text-align: right;">${formatCurrency(totalAmount)}</td>
                  </tr>
                </table>
              </div>
              
              <!-- Important Notice -->
              <div style="background-color: rgba(34,197,94,0.1); border: 1px solid rgba(34,197,94,0.2); border-radius: 8px; padding: 20px; margin-bottom: 30px;">
                <p style="margin: 0;">
                  <strong style="color: #ffffff;">Información Importante:</strong>
                  <span style="color: rgba(255,255,255,0.7); font-size: 14px; line-height: 1.6;">
                    Los invitados adicionales SOLO podrán asistir a la cena del sábado. No tendrán acceso a las sesiones de entrenamiento ni a otras actividades del evento.
                  </span>
                </p>
              </div>
              
              <!-- CTA Button -->
              <table border="0" cellspacing="0" cellpadding="0" style="margin: 30px auto;">
                <tr>
                  <td align="center">
                    <a href="${manageRegistrationUrl}" target="_blank" style="display: inline-block; padding: 15px 40px; font-size: 16px; font-weight: 600; color: #ffffff; background-color: #22c55e; text-decoration: none; border-radius: 8px; box-shadow: 0 4px 12px rgba(34,197,94,0.3);">
                      Ver Mi Registro Completo
                    </a>
                  </td>
                </tr>
              </table>
              
              <p style="font-size: 16px; color: rgba(255,255,255,0.9); margin: 20px 0 0 0;">
                Si tienes alguna pregunta o necesitas hacer cambios adicionales, no dudes en contactarnos.
              </p>
              
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: rgba(255,255,255,0.03); padding: 30px 40px; text-align: center; border-top: 1px solid rgba(255,255,255,0.1);">
              <p style="margin: 0 0 10px 0; color: rgba(255,255,255,0.6); font-size: 14px;">
                © ${new Date().getFullYear()} DayTradeDak. Todos los derechos reservados.
              </p>
              <p style="margin: 0 0 10px 0; color: rgba(255,255,255,0.6); font-size: 14px;">
                Este es un correo automático, por favor no respondas a este mensaje.
              </p>
              <div style="margin-top: 20px;">
                <a href="https://daytradedak.com" style="color: rgba(255,255,255,0.6); font-size: 12px; text-decoration: none; margin: 0 10px;">
                  Sitio Web
                </a>
                <span style="color: rgba(255,255,255,0.3);">|</span>
                <a href="https://facebook.com/daytradedak" style="color: rgba(255,255,255,0.6); font-size: 12px; text-decoration: none; margin: 0 10px;">
                  Facebook
                </a>
                <span style="color: rgba(255,255,255,0.3);">|</span>
                <a href="https://instagram.com/daytradedak" style="color: rgba(255,255,255,0.6); font-size: 12px; text-decoration: none; margin: 0 10px;">
                  Instagram
                </a>
              </div>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>

</body>
</html>
  `.trim();
};