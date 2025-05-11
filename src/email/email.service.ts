// src/email/email.service.ts
import { Injectable } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class EmailService {
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
