export interface EmailTemplateData {
  preheader?: string;
  content: string;
}

export const baseEmailTemplate = (data: EmailTemplateData): string => {
  const { preheader = '', content } = data;

  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>DayTradeDak</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
  <style>
    /* Reset styles */
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; }

    /* Remove default styling */
    img { border: 0; outline: none; text-decoration: none; }
    table { border-collapse: collapse !important; }
    body { margin: 0 !important; padding: 0 !important; width: 100% !important; min-width: 100% !important; }

    /* Mobile styles */
    @media screen and (max-width: 600px) {
      .mobile-padding { padding: 20px !important; }
      .mobile-center { text-align: center !important; }
      .container { width: 100% !important; max-width: 100% !important; }
      .mobile-button { width: 100% !important; }
      .mobile-text { font-size: 16px !important; line-height: 24px !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #f5f5f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  
  <!-- Preheader text -->
  <div style="display: none; font-size: 1px; color: #f5f5f5; line-height: 1px; max-height: 0px; max-width: 0px; opacity: 0; overflow: hidden;">
    ${preheader}
  </div>

  <!-- Email container -->
  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f5f5f5; padding: 20px 0;">
    <tr>
      <td align="center">
        <table class="container" border="0" cellpadding="0" cellspacing="0" width="600" style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); overflow: hidden;">
          
          <!-- Header -->
          <tr>
            <td style="background-color: #121621; padding: 30px 40px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700; letter-spacing: -0.5px;">
                DayTrade<span style="color: #16a34a;">Dak</span>
              </h1>
              <p style="margin: 10px 0 0 0; color: #9ca3af; font-size: 14px;">
                Tu camino hacia el éxito en el trading
              </p>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td class="mobile-padding" style="padding: 40px;">
              ${content}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 30px 40px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0 0 10px 0; color: #6b7280; font-size: 14px; line-height: 21px;">
                © ${new Date().getFullYear()} DayTradeDak. Todos los derechos reservados.
              </p>
              <p style="margin: 0 0 10px 0; color: #6b7280; font-size: 14px; line-height: 21px;">
                ¿Necesitas ayuda? Contáctanos en <a href="mailto:support@daytradedak.com" style="color: #16a34a; text-decoration: none;">support@daytradedak.com</a>
              </p>
              <div style="margin-top: 20px;">
                <a href="https://daytradedak.com" style="color: #6b7280; font-size: 12px; text-decoration: none;">
                  Visitar sitio web
                </a>
                <span style="color: #d1d5db; margin: 0 10px;">|</span>
                <a href="https://daytradedak.com/fulfillment-policies/" style="color: #6b7280; font-size: 12px; text-decoration: none;">
                  Política de privacidad
                </a>
                <span style="color: #d1d5db; margin: 0 10px;">|</span>
                <a href="https://daytradedak.com/fulfillment-policies/" style="color: #6b7280; font-size: 12px; text-decoration: none;">
                  Términos de servicio
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

// Helper function to create a button
export const emailButton = (
  text: string,
  href: string,
  style: 'primary' | 'secondary' = 'primary',
): string => {
  const bgColor = style === 'primary' ? '#16a34a' : '#ffffff';
  const textColor = style === 'primary' ? '#ffffff' : '#16a34a';
  const border = style === 'secondary' ? 'border: 2px solid #16a34a;' : '';

  return `
    <table border="0" cellspacing="0" cellpadding="0" style="margin: 30px auto;">
      <tr>
        <td align="center">
          <a href="${href}" target="_blank" style="display: inline-block; padding: 14px 32px; font-size: 16px; font-weight: 600; color: ${textColor}; background-color: ${bgColor}; text-decoration: none; border-radius: 6px; ${border}">
            ${text}
          </a>
        </td>
      </tr>
    </table>
  `;
};

// Helper function to create a info box
export const emailInfoBox = (
  content: string,
  style: 'info' | 'warning' | 'success' = 'info',
): string => {
  const colors = {
    info: { bg: '#eff6ff', border: '#3b82f6', text: '#1e40af' },
    warning: { bg: '#fef3c7', border: '#f59e0b', text: '#92400e' },
    success: { bg: '#f0fdf4', border: '#16a34a', text: '#166534' },
  };

  const { bg, border, text } = colors[style];

  return `
    <div style="background-color: ${bg}; border: 1px solid ${border}; border-radius: 6px; padding: 16px; margin: 20px 0;">
      <p style="margin: 0; color: ${text}; font-size: 14px; line-height: 21px;">
        ${content}
      </p>
    </div>
  `;
};

// Helper function to create a divider
export const emailDivider = (): string => {
  return '<hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">';
};
