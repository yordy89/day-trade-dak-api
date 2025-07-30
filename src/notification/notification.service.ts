import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Notification, NotificationDocument, NotificationStatus, NotificationType, NotificationPriority } from './notification.schema';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { UpdateNotificationDto } from './dto/update-notification.dto';
import { WebSocketGateway } from '../websockets/websockets.gateway';

@Injectable()
export class NotificationService {
  constructor(
    @InjectModel(Notification.name)
    private notificationModel: Model<NotificationDocument>,
    private websocketGateway: WebSocketGateway,
  ) {}

  async create(createNotificationDto: CreateNotificationDto): Promise<Notification> {
    const createdNotification = new this.notificationModel(createNotificationDto);
    const savedNotification = await createdNotification.save();
    
    // Emit WebSocket event for new notification
    await this.emitNewNotificationEvent(savedNotification);
    
    return savedNotification;
  }

  async findAll(params: {
    recipient?: string;
    type?: NotificationType;
    status?: NotificationStatus;
    page?: number;
    limit?: number;
  }) {
    const { recipient, type, status, page = 1, limit = 20 } = params;
    const query: any = {};
    
    if (recipient) query.recipient = recipient;
    if (type) query.type = type;
    if (status) query.status = status;
    
    const skip = (page - 1) * limit;
    
    const [notifications, total] = await Promise.all([
      this.notificationModel
        .find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.notificationModel.countDocuments(query),
    ]);
    
    return {
      notifications,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: string): Promise<Notification> {
    const notification = await this.notificationModel.findById(id);
    if (!notification) {
      throw new NotFoundException('Notification not found');
    }
    return notification;
  }

  async update(id: string, updateNotificationDto: UpdateNotificationDto): Promise<Notification> {
    const notification = await this.notificationModel.findById(id);
    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    // If marking as read, set readAt timestamp
    if (updateNotificationDto.status === NotificationStatus.READ && notification.status === NotificationStatus.UNREAD) {
      notification.readAt = new Date();
    }

    Object.assign(notification, updateNotificationDto);
    const updatedNotification = await notification.save();
    
    // Emit WebSocket event for notification update
    await this.emitNotificationUpdateEvent(updatedNotification);
    
    return updatedNotification;
  }

  async markAsRead(id: string): Promise<Notification> {
    return this.update(id, { status: NotificationStatus.READ });
  }

  async markAllAsRead(recipient: string): Promise<void> {
    await this.notificationModel.updateMany(
      { recipient, status: NotificationStatus.UNREAD },
      { 
        $set: { 
          status: NotificationStatus.READ,
          readAt: new Date()
        } 
      }
    );
    
    // Emit WebSocket event for bulk update
    const unreadCount = await this.getUnreadCount(recipient);
    this.websocketGateway.server.emit('notification:bulk-update', {
      recipient,
      action: 'mark-all-read',
      unreadCount,
    });
  }

  async remove(id: string): Promise<void> {
    const notification = await this.notificationModel.findByIdAndDelete(id);
    if (!notification) {
      throw new NotFoundException('Notification not found');
    }
    
    // Emit WebSocket event for notification deletion
    this.websocketGateway.server.emit('notification:deleted', {
      notificationId: id,
      recipient: notification.recipient,
    });
  }

  async getUnreadCount(recipient?: string): Promise<number> {
    const query: any = { status: NotificationStatus.UNREAD };
    if (recipient) query.recipient = recipient;
    
    return this.notificationModel.countDocuments(query);
  }

  async createContactMessageNotification(data: {
    name: string;
    email: string;
    inquiryType: string;
    messageId: string;
  }): Promise<Notification> {
    const notification = await this.create({
      type: NotificationType.CONTACT_MESSAGE,
      title: 'New Contact Message',
      message: `${data.name} sent a new ${data.inquiryType} inquiry`,
      data: {
        messageId: data.messageId,
        senderName: data.name,
        senderEmail: data.email,
        inquiryType: data.inquiryType,
      },
      priority: NotificationPriority.HIGH,
      actionUrl: `/contact-messages?id=${data.messageId}`,
      icon: 'message',
    });
    
    return notification;
  }

  private async emitNewNotificationEvent(notification: NotificationDocument) {
    const unreadCount = await this.getUnreadCount(notification.recipient);
    
    // Emit new notification event
    this.websocketGateway.server.emit('notification:new', {
      notification: {
        _id: notification._id,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        priority: notification.priority,
        actionUrl: notification.actionUrl,
        icon: notification.icon,
        createdAt: notification.createdAt,
      },
      recipient: notification.recipient,
      unreadCount,
    });
  }

  private async emitNotificationUpdateEvent(notification: NotificationDocument) {
    const unreadCount = await this.getUnreadCount(notification.recipient);
    
    // Emit notification update event
    this.websocketGateway.server.emit('notification:updated', {
      notificationId: notification._id,
      status: notification.status,
      recipient: notification.recipient,
      unreadCount,
    });
  }
}