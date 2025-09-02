import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  EmailTemplate,
  EmailTemplateDocument,
  TemplateCategory,
} from '../schemas/email-template.schema';
import { CreateTemplateDto } from '../dto/create-template.dto';

@Injectable()
export class TemplateService {
  private readonly logger = new Logger(TemplateService.name);

  constructor(
    @InjectModel(EmailTemplate.name)
    private templateModel: Model<EmailTemplateDocument>,
  ) {}

  async create(createTemplateDto: CreateTemplateDto, userId: string) {
    try {
      const template = new this.templateModel({
        ...createTemplateDto,
        createdBy: new Types.ObjectId(userId),
      });

      const saved = await template.save();
      this.logger.log(`Template created: ${saved._id}`);
      return saved;
    } catch (error) {
      this.logger.error('Error creating template:', error);
      throw error;
    }
  }

  async findAll(
    filters?: {
      category?: TemplateCategory;
      isPublic?: boolean;
      tags?: string[];
      userId?: string;
    },
    pagination?: { page: number; limit: number },
  ) {
    const query: any = { isActive: true };

    if (filters?.category) {
      query.category = filters.category;
    }

    if (filters?.isPublic !== undefined) {
      query.isPublic = filters.isPublic;
    }

    if (filters?.tags?.length) {
      query.tags = { $in: filters.tags };
    }

    if (filters?.userId) {
      query.$or = [
        { isPublic: true },
        { createdBy: new Types.ObjectId(filters.userId) },
      ];
    }

    const page = pagination?.page || 1;
    const limit = pagination?.limit || 20;
    const skip = (page - 1) * limit;

    const [templates, total] = await Promise.all([
      this.templateModel
        .find(query)
        .populate('createdBy', 'firstName lastName email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      this.templateModel.countDocuments(query),
    ]);

    return {
      templates,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string) {
    const template = await this.templateModel
      .findById(id)
      .populate('createdBy', 'firstName lastName email');

    if (!template) {
      throw new NotFoundException('Template not found');
    }

    // Update usage stats
    await this.templateModel.findByIdAndUpdate(id, {
      $inc: { usageCount: 1 },
      lastUsed: new Date(),
    });

    return template;
  }

  async update(id: string, updateTemplateDto: Partial<CreateTemplateDto>, userId: string) {
    const template = await this.findOne(id);

    // Check ownership
    if (template.createdBy._id.toString() !== userId && !template.isPublic) {
      throw new BadRequestException('You can only edit your own templates');
    }

    const updated = await this.templateModel.findByIdAndUpdate(
      id,
      {
        ...updateTemplateDto,
        lastModifiedBy: new Types.ObjectId(userId),
      },
      { new: true },
    );

    this.logger.log(`Template updated: ${id}`);
    return updated;
  }

  async delete(id: string, userId: string) {
    const template = await this.findOne(id);

    // Check ownership
    if (template.createdBy._id.toString() !== userId) {
      throw new BadRequestException('You can only delete your own templates');
    }

    // Soft delete
    await this.templateModel.findByIdAndUpdate(id, { isActive: false });
    this.logger.log(`Template deleted: ${id}`);
  }

  async duplicate(id: string, userId: string) {
    const template = await this.findOne(id);

    const newTemplate = new this.templateModel({
      name: `${template.name} (Copy)`,
      description: template.description,
      category: template.category,
      thumbnail: template.thumbnail,
      htmlContent: template.htmlContent,
      jsonConfig: template.jsonConfig,
      defaultValues: template.defaultValues,
      isPublic: false,
      createdBy: new Types.ObjectId(userId),
      tags: template.tags,
      variables: template.variables,
      metadata: template.metadata,
    });

    const saved = await newTemplate.save();
    this.logger.log(`Template duplicated: ${id} -> ${saved._id}`);
    return saved;
  }

  async getDefaultTemplates() {
    // Return pre-built templates for common use cases
    return [
      {
        id: 'newsletter',
        name: 'Newsletter Template',
        category: TemplateCategory.NEWSLETTER,
        thumbnail: '/templates/newsletter.png',
        description: 'Professional newsletter template with header, content sections, and footer',
        htmlContent: this.getNewsletterTemplate(),
      },
      {
        id: 'promotional',
        name: 'Promotional Template',
        category: TemplateCategory.PROMOTIONAL,
        thumbnail: '/templates/promotional.png',
        description: 'Eye-catching promotional template for special offers',
        htmlContent: this.getPromotionalTemplate(),
      },
      {
        id: 'announcement',
        name: 'Announcement Template',
        category: TemplateCategory.ANNOUNCEMENT,
        thumbnail: '/templates/announcement.png',
        description: 'Clean announcement template for important updates',
        htmlContent: this.getAnnouncementTemplate(),
      },
      {
        id: 'event',
        name: 'Event Invitation Template',
        category: TemplateCategory.EVENT,
        thumbnail: '/templates/event.png',
        description: 'Elegant event invitation template',
        htmlContent: this.getEventTemplate(),
      },
    ];
  }

  private getNewsletterTemplate(): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body { font-family: 'Helvetica Neue', Arial, sans-serif; margin: 0; padding: 0; background-color: #f4f4f4; }
          .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; }
          .header { background-color: #16a34a; color: white; padding: 30px; text-align: center; }
          .content { padding: 30px; }
          .footer { background-color: #f8f8f8; padding: 20px; text-align: center; font-size: 12px; color: #666; }
          .button { display: inline-block; padding: 12px 24px; background-color: #16a34a; color: white; text-decoration: none; border-radius: 4px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>DayTradeDak Newsletter</h1>
          </div>
          <div class="content">
            <h2>Hello {{firstName}},</h2>
            <p>Welcome to this week's newsletter. Here are the latest updates from DayTradeDak.</p>
            <h3>Featured Content</h3>
            <p>Add your newsletter content here...</p>
            <p style="text-align: center; margin-top: 30px;">
              <a href="#" class="button">Read More</a>
            </p>
          </div>
          <div class="footer">
            <p>&copy; 2024 DayTradeDak. All rights reserved.</p>
            <p><a href="#">Unsubscribe</a> | <a href="#">Update Preferences</a></p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  private getPromotionalTemplate(): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body { font-family: 'Helvetica Neue', Arial, sans-serif; margin: 0; padding: 0; background-color: #f4f4f4; }
          .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; }
          .header { background: linear-gradient(135deg, #16a34a 0%, #15803d 100%); color: white; padding: 40px; text-align: center; }
          .offer-badge { background-color: #ef4444; color: white; padding: 5px 15px; border-radius: 20px; display: inline-block; margin-bottom: 20px; }
          .content { padding: 30px; text-align: center; }
          .price { font-size: 48px; font-weight: bold; color: #16a34a; }
          .footer { background-color: #f8f8f8; padding: 20px; text-align: center; font-size: 12px; color: #666; }
          .cta-button { display: inline-block; padding: 15px 40px; background-color: #ef4444; color: white; text-decoration: none; border-radius: 4px; font-size: 18px; font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="offer-badge">LIMITED TIME OFFER</div>
            <h1>Special Promotion</h1>
          </div>
          <div class="content">
            <h2>Dear {{firstName}},</h2>
            <p>Don't miss this exclusive offer!</p>
            <div class="price">50% OFF</div>
            <p>Valid until [Date]</p>
            <p style="margin-top: 30px;">
              <a href="#" class="cta-button">CLAIM OFFER NOW</a>
            </p>
          </div>
          <div class="footer">
            <p>&copy; 2024 DayTradeDak. All rights reserved.</p>
            <p><a href="#">Unsubscribe</a></p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  private getAnnouncementTemplate(): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body { font-family: 'Helvetica Neue', Arial, sans-serif; margin: 0; padding: 0; background-color: #f4f4f4; }
          .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; }
          .header { background-color: #16a34a; color: white; padding: 30px; }
          .content { padding: 30px; }
          .announcement-box { background-color: #f0fdf4; border-left: 4px solid #16a34a; padding: 20px; margin: 20px 0; }
          .footer { background-color: #f8f8f8; padding: 20px; text-align: center; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Important Announcement</h1>
          </div>
          <div class="content">
            <h2>Hello {{firstName}},</h2>
            <div class="announcement-box">
              <h3>Announcement Title</h3>
              <p>Your announcement content goes here...</p>
            </div>
            <p>If you have any questions, please don't hesitate to contact us.</p>
          </div>
          <div class="footer">
            <p>&copy; 2024 DayTradeDak. All rights reserved.</p>
            <p><a href="#">Unsubscribe</a></p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  private getEventTemplate(): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body { font-family: 'Helvetica Neue', Arial, sans-serif; margin: 0; padding: 0; background-color: #f4f4f4; }
          .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; }
          .header { background: url('event-banner.jpg') center/cover; position: relative; height: 300px; }
          .header-overlay { background: rgba(22, 163, 74, 0.8); position: absolute; top: 0; left: 0; right: 0; bottom: 0; display: flex; align-items: center; justify-content: center; color: white; text-align: center; }
          .content { padding: 30px; }
          .event-details { background-color: #f9f9f9; padding: 20px; border-radius: 8px; margin: 20px 0; }
          .footer { background-color: #f8f8f8; padding: 20px; text-align: center; font-size: 12px; color: #666; }
          .register-button { display: inline-block; padding: 15px 30px; background-color: #16a34a; color: white; text-decoration: none; border-radius: 4px; font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="header-overlay">
              <div>
                <h1>You're Invited!</h1>
                <h2>Event Name</h2>
              </div>
            </div>
          </div>
          <div class="content">
            <h2>Dear {{firstName}},</h2>
            <p>We're excited to invite you to our upcoming event.</p>
            <div class="event-details">
              <h3>Event Details</h3>
              <p><strong>Date:</strong> [Event Date]</p>
              <p><strong>Time:</strong> [Event Time]</p>
              <p><strong>Location:</strong> [Event Location]</p>
            </div>
            <p style="text-align: center; margin-top: 30px;">
              <a href="#" class="register-button">REGISTER NOW</a>
            </p>
          </div>
          <div class="footer">
            <p>&copy; 2024 DayTradeDak. All rights reserved.</p>
            <p><a href="#">Unsubscribe</a></p>
          </div>
        </div>
      </body>
      </html>
    `;
  }
}