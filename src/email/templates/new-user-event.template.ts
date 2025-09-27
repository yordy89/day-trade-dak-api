export interface NewUserEventData {
  firstName: string;
  lastName: string;
  email: string;
  temporaryPassword: string;
  eventName: string;
  modules: string[];
  loginUrl?: string;
  expiresAt?: Date;
}

export const newUserEventTemplate = (data: NewUserEventData): string => {
  const loginUrl = data.loginUrl || 'https://app.daytradedak.com/login';

  const modulesList = data.modules.map(module => {
    const moduleNames: Record<string, string> = {
      classes: 'Clases',
      masterClasses: 'Master Classes',
      liveRecorded: 'Live Grabados',
      psicotrading: 'Psicotrading',
      peaceWithMoney: 'Paz con el Dinero',
      liveWeekly: 'Live Semanal',
      communityEvents: 'Eventos Comunitarios',
      vipEvents: 'Eventos VIP',
      masterCourse: 'Master Course',
      stocks: 'Acciones',
    };
    return moduleNames[module] || module;
  }).join(', ');

  const expirationInfo = data.expiresAt
    ? `<p style="color: #666; margin-top: 15px;">
        <strong>Nota:</strong> Tu acceso expira el ${new Date(data.expiresAt).toLocaleDateString('es-ES', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        })}
      </p>`
    : '';

  return `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Bienvenido a DayTradeDak</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f7f7f7;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f7f7f7; padding: 20px 0;">
        <tr>
          <td align="center">
            <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
              <!-- Header -->
              <tr>
                <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 30px; border-radius: 10px 10px 0 0;">
                  <h1 style="color: #ffffff; margin: 0; font-size: 28px; text-align: center;">
                    ¡Bienvenido a Day Trade Dak! 🚀
                  </h1>
                  <p style="color: #ffffff; text-align: center; margin-top: 10px; font-size: 16px; opacity: 0.95;">
                    Tu cuenta ha sido creada exitosamente
                  </p>
                </td>
              </tr>

              <!-- Content -->
              <tr>
                <td style="padding: 40px 30px;">
                  <h2 style="color: #333; margin-top: 0; margin-bottom: 20px;">
                    Hola ${data.firstName} ${data.lastName},
                  </h2>

                  <p style="color: #666; line-height: 1.6; margin-bottom: 20px;">
                    Se ha creado una cuenta para ti en Day Trade Dak como parte de tu registro al evento
                    <strong>${data.eventName}</strong>. Ahora tienes acceso a contenido exclusivo y herramientas
                    para mejorar tu experiencia en trading.
                  </p>

                  <!-- Access Info Box -->
                  <div style="background-color: #f0f7ff; border-left: 4px solid #667eea; padding: 20px; margin: 30px 0; border-radius: 5px;">
                    <h3 style="color: #333; margin-top: 0; margin-bottom: 15px;">
                      📋 Información de Acceso
                    </h3>
                    <table style="width: 100%;">
                      <tr>
                        <td style="padding: 5px 0; color: #666;">
                          <strong>Email:</strong>
                        </td>
                        <td style="padding: 5px 0; color: #333;">
                          ${data.email}
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 5px 0; color: #666;">
                          <strong>Contraseña temporal:</strong>
                        </td>
                        <td style="padding: 5px 0; color: #333; font-family: monospace; font-size: 14px; background-color: #f5f5f5; padding: 8px; border-radius: 3px;">
                          ${data.temporaryPassword}
                        </td>
                      </tr>
                    </table>
                  </div>

                  <!-- Modules Access -->
                  <div style="background-color: #f9f9f9; padding: 20px; margin: 30px 0; border-radius: 5px;">
                    <h3 style="color: #333; margin-top: 0; margin-bottom: 15px;">
                      🎯 Módulos con Acceso
                    </h3>
                    <p style="color: #666; margin: 0;">
                      Tienes acceso a los siguientes módulos:
                    </p>
                    <p style="color: #667eea; font-weight: bold; margin-top: 10px;">
                      ${modulesList}
                    </p>
                    ${expirationInfo}
                  </div>

                  <!-- Steps -->
                  <h3 style="color: #333; margin-top: 30px; margin-bottom: 20px;">
                    🚀 Pasos para comenzar:
                  </h3>

                  <ol style="color: #666; line-height: 1.8; padding-left: 20px;">
                    <li style="margin-bottom: 10px;">
                      <strong>Inicia sesión</strong> con tu email y contraseña temporal
                    </li>
                    <li style="margin-bottom: 10px;">
                      <strong>Cambia tu contraseña</strong> por una más segura que solo tú conozcas
                    </li>
                    <li style="margin-bottom: 10px;">
                      <strong>Completa tu perfil</strong> con tu información personal
                    </li>
                    <li style="margin-bottom: 10px;">
                      <strong>Explora los módulos</strong> a los que tienes acceso
                    </li>
                  </ol>

                  <!-- CTA Button -->
                  <div style="text-align: center; margin: 40px 0;">
                    <a href="${loginUrl}" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; padding: 15px 40px; border-radius: 50px; font-weight: bold; font-size: 16px; box-shadow: 0 4px 15px rgba(102, 126, 234, 0.3);">
                      Iniciar Sesión Ahora
                    </a>
                  </div>

                  <!-- Security Notice -->
                  <div style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 30px 0; border-radius: 5px;">
                    <p style="color: #856404; margin: 0; font-size: 14px;">
                      <strong>⚠️ Importante:</strong> Por tu seguridad, te recomendamos cambiar tu contraseña
                      temporal en tu primer inicio de sesión. Nunca compartas tus credenciales con nadie.
                    </p>
                  </div>

                  <!-- Support -->
                  <p style="color: #666; line-height: 1.6; margin-top: 30px;">
                    Si tienes alguna pregunta o necesitas ayuda, no dudes en contactarnos:
                  </p>

                  <ul style="color: #666; line-height: 1.8; padding-left: 20px;">
                    <li>Email: <a href="mailto:support@daytradedak.com" style="color: #667eea; text-decoration: none;">support@daytradedak.com</a></li>
                    <li>WhatsApp: <a href="https://wa.me/1234567890" style="color: #667eea; text-decoration: none;">+1 (234) 567-890</a></li>
                  </ul>
                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td style="background-color: #f9f9f9; padding: 30px; text-align: center; border-radius: 0 0 10px 10px;">
                  <p style="color: #999; margin: 0 0 10px 0; font-size: 14px;">
                    © 2025 Day Trade Dak. Todos los derechos reservados.
                  </p>
                  <p style="color: #999; margin: 0; font-size: 12px;">
                    Este email fue enviado porque te registraste en el evento ${data.eventName}.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
};