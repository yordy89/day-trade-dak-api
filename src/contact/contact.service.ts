import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ContactMessage, ContactMessageDocument, ContactMessageStatus } from './contact-message.schema';
import { CreateContactMessageDto } from './dto/create-contact-message.dto';
import { UpdateContactMessageDto } from './dto/update-contact-message.dto';
import { EmailService } from '../email/email.service';
import { SettingsService } from '../settings/settings.service';
import { WebSocketGateway } from '../websockets/websockets.gateway';
import { NotificationService } from '../notification/notification.service';
import { 
  baseEmailTemplate, 
  emailButton, 
  emailInfoBox,
  emailDivider 
} from '../email/templates/base-email.template';

@Injectable()
export class ContactService {
  constructor(
    @InjectModel(ContactMessage.name)
    private contactMessageModel: Model<ContactMessageDocument>,
    private emailService: EmailService,
    private settingsService: SettingsService,
    private websocketGateway: WebSocketGateway,
    private notificationService: NotificationService,
  ) {}

  async create(createContactMessageDto: CreateContactMessageDto): Promise<ContactMessage> {
    const createdMessage = new this.contactMessageModel(createContactMessageDto);
    const savedMessage = await createdMessage.save();

    // Send email notifications
    await this.sendNotificationEmails(savedMessage);

    // Emit WebSocket event for real-time notifications
    await this.emitNewMessageEvent(savedMessage);

    return savedMessage;
  }

  async findAll(query: {
    status?: ContactMessageStatus;
    inquiryType?: string;
    startDate?: Date;
    endDate?: Date;
    page?: number;
    limit?: number;
  }) {
    const { 
      status, 
      inquiryType, 
      startDate, 
      endDate,
      page = 1,
      limit = 20 
    } = query;

    const filter: any = {};
    
    if (status) filter.status = status;
    if (inquiryType) filter.inquiryType = inquiryType;
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = startDate;
      if (endDate) filter.createdAt.$lte = endDate;
    }

    const skip = (page - 1) * limit;

    const [messages, total] = await Promise.all([
      this.contactMessageModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.contactMessageModel.countDocuments(filter),
    ]);

    return {
      messages,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: string): Promise<ContactMessage> {
    const message = await this.contactMessageModel.findById(id);
    if (!message) {
      throw new NotFoundException(`Contact message with ID ${id} not found`);
    }
    return message;
  }

  async update(
    id: string, 
    updateContactMessageDto: UpdateContactMessageDto,
    userId?: string
  ): Promise<ContactMessage> {
    const updateData: any = { ...updateContactMessageDto };
    
    // If marking as read, add readAt and readBy
    if (updateContactMessageDto.status === ContactMessageStatus.READ) {
      updateData.readAt = new Date();
      if (userId) updateData.readBy = userId;
    }

    const updatedMessage = await this.contactMessageModel.findByIdAndUpdate(
      id,
      updateData,
      { new: true }
    );

    if (!updatedMessage) {
      throw new NotFoundException(`Contact message with ID ${id} not found`);
    }

    // Emit status update event
    if (updateContactMessageDto.status) {
      await this.emitStatusUpdateEvent(updatedMessage);
    }

    return updatedMessage;
  }

  async remove(id: string): Promise<void> {
    const result = await this.contactMessageModel.deleteOne({ _id: id });
    if (result.deletedCount === 0) {
      throw new NotFoundException(`Contact message with ID ${id} not found`);
    }
  }

  async getUnreadCount(): Promise<number> {
    return this.contactMessageModel.countDocuments({ 
      status: ContactMessageStatus.UNREAD 
    });
  }

  private async sendNotificationEmails(message: ContactMessage) {
    try {
      // Get notification email recipients from settings
      const notificationEmails = await this.settingsService.getValue(
        'notification_emails',
        []
      );

      if (!notificationEmails || notificationEmails.length === 0) {
        console.log('No notification emails configured');
        return;
      }

      // Create email content
      const emailContent = `
        <h2 style="color: #1f2937; margin: 0 0 20px 0;">Nuevo Mensaje de Contacto</h2>
        
        ${emailInfoBox('Has recibido un nuevo mensaje a través del formulario de contacto.', 'info')}
        
        <h3 style="color: #374151; margin: 30px 0 15px 0;">Detalles del Mensaje</h3>
        
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">
              <strong style="color: #6b7280;">Nombre:</strong>
            </td>
            <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">
              ${message.name}
            </td>
          </tr>
          <tr>
            <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">
              <strong style="color: #6b7280;">Email:</strong>
            </td>
            <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">
              <a href="mailto:${message.email}" style="color: #16a34a; text-decoration: none;">
                ${message.email}
              </a>
            </td>
          </tr>
          ${message.phone ? `
          <tr>
            <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">
              <strong style="color: #6b7280;">Teléfono:</strong>
            </td>
            <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">
              ${message.phone}
            </td>
          </tr>
          ` : ''}
          <tr>
            <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">
              <strong style="color: #6b7280;">Tipo de Consulta:</strong>
            </td>
            <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">
              ${this.getInquiryTypeLabel(message.inquiryType)}
            </td>
          </tr>
          <tr>
            <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">
              <strong style="color: #6b7280;">Fecha:</strong>
            </td>
            <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">
              ${new Date((message as any).createdAt).toLocaleString('es-ES')}
            </td>
          </tr>
        </table>
        
        <h3 style="color: #374151; margin: 30px 0 15px 0;">Mensaje</h3>
        <div style="background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; padding: 20px; margin: 15px 0;">
          <p style="margin: 0; color: #374151; line-height: 1.6; white-space: pre-wrap;">
            ${message.message}
          </p>
        </div>
        
        ${emailButton(
          'Ver en el Panel de Admin',
          `${process.env.ADMIN_URL || 'https://admin.daytradedak.com'}/contact-messages/${(message as any)._id}`,
          'primary'
        )}
        
        ${emailDivider()}
        
        <p style="color: #6b7280; font-size: 14px; text-align: center; margin: 20px 0 0 0;">
          Este es un mensaje automático. Por favor, responde directamente al remitente.
        </p>
      `;

      const html = baseEmailTemplate({
        content: emailContent,
        preheader: `Nuevo mensaje de ${message.name} - ${this.getInquiryTypeLabel(message.inquiryType)}`,
      });

      // Send email to each recipient
      for (const email of notificationEmails) {
        await this.emailService.sendBasicEmail(
          email,
          `Nuevo Mensaje de Contacto - ${message.name}`,
          html
        );
      }
    } catch (error) {
      console.error('Error sending notification emails:', error);
      // Don't throw - we don't want to fail the contact message creation
    }
  }

  private getInquiryTypeLabel(type: string): string {
    const labels = {
      general: 'General',
      technical: 'Soporte Técnico',
      billing: 'Facturación',
      partnership: 'Asociación',
      media: 'Medios',
      other: 'Otro',
    };
    return labels[type] || type;
  }

  private async emitNewMessageEvent(message: ContactMessage) {
    // Create a notification for the new contact message
    await this.notificationService.createContactMessageNotification({
      name: message.name,
      email: message.email,
      inquiryType: message.inquiryType,
      messageId: (message as any)._id.toString(),
    });
    
    // Also emit legacy event for backward compatibility
    const unreadCount = await this.getUnreadCount();
    this.websocketGateway.server.emit('new-contact-message', {
      message: {
        _id: (message as any)._id,
        name: message.name,
        email: message.email,
        inquiryType: message.inquiryType,
        createdAt: (message as any).createdAt,
      },
      unreadCount,
    });
  }

  private async emitStatusUpdateEvent(message: ContactMessage) {
    const unreadCount = await this.getUnreadCount();
    
    // Emit status update event
    this.websocketGateway.server.emit('contact-message-updated', {
      messageId: (message as any)._id,
      status: message.status,
      unreadCount,
    });
  }
}