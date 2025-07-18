import {
  baseEmailTemplate,
  emailButton,
  emailInfoBox,
} from './base-email.template';

export interface WelcomeEmailData {
  firstName: string;
  email: string;
}

export const welcomeEmailTemplate = (data: WelcomeEmailData): string => {
  const { firstName, email } = data;

  const content = `
    <h2 style="margin: 0 0 20px 0; color: #212636; font-size: 24px; font-weight: 600;">
      ¡Bienvenido a DayTradeDak, ${firstName}! 🎉
    </h2>

    <p style="margin: 0 0 20px 0; color: #4b5563; font-size: 16px; line-height: 24px;">
      Nos emociona tenerte como parte de nuestra comunidad de traders. Estás a punto de comenzar un viaje transformador hacia el éxito en el trading.
    </p>

    <p style="margin: 0 0 20px 0; color: #4b5563; font-size: 16px; line-height: 24px;">
      Tu cuenta ha sido creada exitosamente con el correo: <strong style="color: #212636;">${email}</strong>
    </p>

    <h3 style="margin: 30px 0 15px 0; color: #212636; font-size: 18px; font-weight: 600;">
      🚀 Próximos pasos
    </h3>

    <ul style="margin: 0 0 20px 0; padding-left: 20px; color: #4b5563; font-size: 16px; line-height: 28px;">
      <li><strong>Explora nuestras clases:</strong> Accede a más de 40 horas de contenido educativo estructurado.</li>
      <li><strong>Únete a las sesiones en vivo:</strong> Trading en tiempo real de lunes a viernes a las 8:45 AM EST.</li>
      <li><strong>Domina tu psicología:</strong> Descubre nuestro programa de PsicoTrading para controlar tus emociones.</li>
      <li><strong>Conéctate con la comunidad:</strong> Aprende junto a otros traders comprometidos con su éxito.</li>
    </ul>

    ${emailInfoBox(
      'Consejo: Comienza con nuestro curso de "Clases" para establecer una base sólida en trading profesional.',
      'info',
    )}

    ${emailButton('Ir a mi cuenta', `${process.env.FRONTEND_URL}/academy`)}

    <h3 style="margin: 30px 0 15px 0; color: #212636; font-size: 18px; font-weight: 600;">
      📚 Recursos recomendados para empezar
    </h3>

    <div style="background-color: #f9fafb; border-radius: 6px; padding: 20px; margin: 20px 0;">
      <p style="margin: 0 0 10px 0; color: #212636; font-size: 16px; font-weight: 600;">
        Clases de Trading - Curso de 15 días
      </p>
      <p style="margin: 0 0 15px 0; color: #6b7280; font-size: 14px; line-height: 21px;">
        Nuestro programa estructurado te llevará desde los conceptos básicos hasta estrategias avanzadas.
      </p>
      <a href="${process.env.FRONTEND_URL}/academy/classes" style="color: #16a34a; font-size: 14px; font-weight: 600; text-decoration: none;">
        Ver más →
      </a>
    </div>

    <div style="background-color: #f9fafb; border-radius: 6px; padding: 20px; margin: 20px 0;">
      <p style="margin: 0 0 10px 0; color: #212636; font-size: 16px; font-weight: 600;">
        Live Trading Sessions
      </p>
      <p style="margin: 0 0 15px 0; color: #6b7280; font-size: 14px; line-height: 21px;">
        Aprende en tiempo real con nuestros expertos traders cada día de la semana.
      </p>
      <a href="${process.env.FRONTEND_URL}/academy/live-sessions" style="color: #16a34a; font-size: 14px; font-weight: 600; text-decoration: none;">
        Ver más →
      </a>
    </div>

    <p style="margin: 30px 0 0 0; color: #4b5563; font-size: 16px; line-height: 24px;">
      Si tienes alguna pregunta o necesitas ayuda para comenzar, no dudes en contactarnos. Estamos aquí para apoyarte en cada paso del camino.
    </p>

    <p style="margin: 20px 0 0 0; color: #4b5563; font-size: 16px; line-height: 24px;">
      ¡Bienvenido a la familia DayTradeDak!
    </p>

    <p style="margin: 20px 0 0 0; color: #4b5563; font-size: 16px;">
      Un abrazo,<br>
      <strong style="color: #212636;">El equipo de DayTradeDak</strong>
    </p>
  `;

  return baseEmailTemplate({
    preheader:
      'Bienvenido a DayTradeDak - Tu viaje hacia el éxito en el trading comienza aquí',
    content,
  });
};
