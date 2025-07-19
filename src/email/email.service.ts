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

  // Add contact to Brevo list
  async addContactToList(
    email: string,
    listIds: number[],
    attributes?: {
      FIRSTNAME?: string;
      LASTNAME?: string;
      SMS?: string;
      [key: string]: any;
    },
  ) {
    try {
      const response = await axios.post(
        'https://api.brevo.com/v3/contacts',
        {
          email,
          listIds,
          attributes,
          updateEnabled: true, // Update if contact already exists
        },
        {
          headers: {
            'api-key': this.apiKey,
            'Content-Type': 'application/json',
          },
        },
      );

      this.logger.log(`Contact ${email} added to Brevo lists: ${listIds.join(', ')}`);
      return response.data;
    } catch (error) {
      if (error.response?.status === 400) {
        const errorCode = error.response?.data?.code;
        const errorMessage = error.response?.data?.message || '';
        
        // Handle duplicate contact
        if (errorCode === 'duplicate_parameter' && errorMessage.includes('Contact already exist')) {
          return this.updateContactLists(email, listIds, attributes);
        }
        
        // Handle duplicate SMS - retry without SMS
        if (errorCode === 'duplicate_parameter' && errorMessage.includes('SMS')) {
          this.logger.warn(`SMS number already exists, creating contact without SMS`);
          const { SMS, ...attributesWithoutSMS } = attributes || {};
          try {
            const response = await axios.post(
              'https://api.brevo.com/v3/contacts',
              {
                email,
                listIds,
                attributes: attributesWithoutSMS,
                updateEnabled: true,
              },
              {
                headers: {
                  'api-key': this.apiKey,
                  'Content-Type': 'application/json',
                },
              },
            );
            this.logger.log(`Contact ${email} added to Brevo lists (without SMS): ${listIds.join(', ')}`);
            return response.data;
          } catch (retryError) {
            // If still fails, might be existing contact, try update
            if (retryError.response?.status === 400) {
              return this.updateContactLists(email, listIds, attributesWithoutSMS);
            }
            throw retryError;
          }
        }
      }
      
      this.logger.error(
        `Failed to add contact ${email} to Brevo:`,
        error.response?.data || error.message,
      );
      throw error;
    }
  }

  // Update contact lists in Brevo
  private async updateContactLists(
    email: string,
    listIds: number[],
    attributes?: any,
  ) {
    try {
      // First update attributes if provided
      if (attributes && Object.keys(attributes).length > 0) {
        try {
          await axios.put(
            `https://api.brevo.com/v3/contacts/${encodeURIComponent(email)}`,
            {
              attributes,
            },
            {
              headers: {
                'api-key': this.apiKey,
                'Content-Type': 'application/json',
              },
            },
          );
        } catch (updateError) {
          // If SMS is duplicate, remove it and try again
          if (
            updateError.response?.status === 400 &&
            updateError.response?.data?.code === 'duplicate_parameter' &&
            updateError.response?.data?.message?.includes('SMS')
          ) {
            this.logger.warn(`SMS number already exists for another contact, updating without SMS`);
            const { SMS, ...attributesWithoutSMS } = attributes;
            if (Object.keys(attributesWithoutSMS).length > 0) {
              await axios.put(
                `https://api.brevo.com/v3/contacts/${encodeURIComponent(email)}`,
                {
                  attributes: attributesWithoutSMS,
                },
                {
                  headers: {
                    'api-key': this.apiKey,
                    'Content-Type': 'application/json',
                  },
                },
              );
            }
          } else {
            throw updateError;
          }
        }
      }

      // Then add to lists - handle each list individually
      for (const listId of listIds) {
        try {
          await axios.post(
            `https://api.brevo.com/v3/contacts/lists/${listId}/contacts/add`,
            {
              emails: [email],
            },
            {
              headers: {
                'api-key': this.apiKey,
                'Content-Type': 'application/json',
              },
            },
          );
        } catch (listError) {
          // Log but continue with other lists
          this.logger.warn(`Failed to add ${email} to list ${listId}:`, listError.response?.data?.message || listError.message);
        }
      }

      this.logger.log(`Contact ${email} updated in Brevo lists: ${listIds.join(', ')}`);
      return { message: 'Contact updated successfully' };
    } catch (error) {
      this.logger.error(
        `Failed to update contact ${email} in Brevo:`,
        error.response?.data || error.message,
      );
      throw error;
    }
  }

  // Add event registrant to marketing list
  async addEventRegistrantToMarketingList(
    email: string,
    firstName: string,
    lastName?: string,
    phoneNumber?: string,
    eventType?: string,
  ) {
    try {
      // Define list IDs for different purposes (you'll need to get these from Brevo)
      const listIds = [];
      
      // Add to general event registrants list
      const generalEventListId = parseInt(process.env.BREVO_EVENT_LIST_ID || '0');
      if (generalEventListId > 0) {
        listIds.push(generalEventListId);
      }

      // Add to specific event type list if configured
      if (eventType) {
        const eventTypeListId = parseInt(
          process.env[`BREVO_${eventType.toUpperCase()}_LIST_ID`] || '0',
        );
        if (eventTypeListId > 0) {
          listIds.push(eventTypeListId);
        }
      }

      if (listIds.length === 0) {
        this.logger.warn('No Brevo list IDs configured for event registrations');
        return null;
      }

      const attributes: any = {
        FIRSTNAME: firstName,
      };

      if (lastName) attributes.LASTNAME = lastName;
      if (phoneNumber) attributes.SMS = phoneNumber;
      if (eventType) attributes.EVENT_TYPE = eventType;
      attributes.REGISTRATION_DATE = new Date().toISOString();

      return await this.addContactToList(email, listIds, attributes);
    } catch (error) {
      this.logger.error(
        `Failed to add event registrant ${email} to marketing list:`,
        error,
      );
      // Don't throw - we don't want to break the registration flow
      return null;
    }
  }
}
