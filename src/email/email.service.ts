// src/email/email.service.ts
import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import {
  welcomeEmailTemplate,
  WelcomeEmailData,
} from './templates/welcome.template';
import {
  paymentConfirmationTemplate,
  PaymentConfirmationData,
} from './templates/payment-confirmation.template';
import {
  subscriptionExpiringTemplate,
  SubscriptionExpiringData,
} from './templates/subscription-expiring.template';
import {
  eventRegistrationTemplate,
  EventRegistrationData,
} from './templates/event-registration.template';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private apiKey = process.env.BREVO_API_KEY;

  async sendBasicEmail(to: string, subject: string, html: string) {
    return this.send(to, subject, html);
  }

  async sendEventRegistrationTemplate(
    to: string,
    name: string,
    templateId: number,
  ) {
    try {
      const response = await axios.post(
        'https://api.brevo.com/v3/smtp/email',
        {
          to: [{ email: to, name }],
          templateId,
          params: {
            name, // used in the template as {{ params.name }}
          },
          sender: {
            name: 'Day Trade Dak',
            email: process.env.BREVO_EMAIL_SENDER,
          },
        },
        {
          headers: {
            'api-key': this.apiKey,
            'Content-Type': 'application/json',
          },
        },
      );

      return response.data;
    } catch (error) {
      console.error(
        'Error sending template email:',
        error.response?.data || error.message,
      );
      throw new Error('Failed to send email using template');
    }
  }

  async sendEventRegistrationConfirmation(to: string) {
    const subject = 'Confirmación de Registro al Evento';
    const html = `
      <h1>¡Gracias por registrarte!</h1>
      <p>Te has registrado exitosamente al evento. Pronto recibirás más detalles.</p>
    `;

    return this.send(to, subject, html);
  }

  // New template-based methods
  async sendWelcomeEmail(data: WelcomeEmailData) {
    try {
      const html = welcomeEmailTemplate(data);
      const result = await this.send(
        data.email,
        '¡Bienvenido a DayTradeDak! 🎉',
        html,
      );
      this.logger.log(`Welcome email sent to ${data.email}`);
      return result;
    } catch (error) {
      this.logger.error(`Failed to send welcome email to ${data.email}`, error);
      throw error;
    }
  }

  async sendPaymentConfirmationEmail(
    to: string,
    data: PaymentConfirmationData,
  ) {
    try {
      const html = paymentConfirmationTemplate(data);
      const result = await this.send(
        to,
        `Confirmación de pago - ${data.planName}`,
        html,
      );
      this.logger.log(`Payment confirmation email sent to ${to}`);
      return result;
    } catch (error) {
      this.logger.error(
        `Failed to send payment confirmation email to ${to}`,
        error,
      );
      throw error;
    }
  }

  async sendSubscriptionExpiringEmail(
    to: string,
    data: SubscriptionExpiringData,
  ) {
    try {
      const html = subscriptionExpiringTemplate(data);
      const urgencyPrefix = data.daysRemaining <= 1 ? '⏰ ' : '';
      const result = await this.send(
        to,
        `${urgencyPrefix}Tu suscripción ${data.planName} expira pronto`,
        html,
      );
      this.logger.log(`Subscription expiring email sent to ${to}`);
      return result;
    } catch (error) {
      this.logger.error(
        `Failed to send subscription expiring email to ${to}`,
        error,
      );
      throw error;
    }
  }

  async sendEventRegistrationEmail(to: string, data: EventRegistrationData) {
    try {
      const html = eventRegistrationTemplate(data);
      const result = await this.send(
        to,
        `Confirmación de registro - ${data.eventName}`,
        html,
      );
      this.logger.log(`Event registration email sent to ${to}`);
      return result;
    } catch (error) {
      this.logger.error(
        `Failed to send event registration email to ${to}`,
        error,
      );
      throw error;
    }
  }

  private async send(to: string, subject: string, html: string) {
    try {
      const response = await axios.post(
        'https://api.brevo.com/v3/smtp/email',
        {
          sender: {
            name: 'Day Trade Dak',
            email: process.env.BREVO_EMAIL_SENDER,
          },
          to: [{ email: to }],
          subject,
          htmlContent: html,
        },
        {
          headers: {
            'api-key': this.apiKey,
            'Content-Type': 'application/json',
          },
        },
      );

      return response.data;
    } catch (error) {
      console.error(
        'Error sending email:',
        error.response?.data || error.message,
      );
      throw new Error('Failed to send email');
    }
  }
}
