import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Campaign,
  CampaignDocument,
  CampaignStatus,
  CampaignType,
} from '../schemas/campaign.schema';
import {
  CampaignAnalytics,
  CampaignAnalyticsDocument,
} from '../schemas/campaign-analytics.schema';
import { CreateCampaignDto } from '../dto/create-campaign.dto';
import { UpdateCampaignDto } from '../dto/update-campaign.dto';
import { SendTestEmailDto } from '../dto/send-test-email.dto';
import { RecipientService } from './recipient.service';
import { TemplateService } from './template.service';
import { EmailService } from '../../email/email.service';
import { Cron } from '@nestjs/schedule';

@Injectable()
export class CampaignService {
  private readonly logger = new Logger(CampaignService.name);

  constructor(
    @InjectModel(Campaign.name)
    private campaignModel: Model<CampaignDocument>,
    @InjectModel(CampaignAnalytics.name)
    private analyticsModel: Model<CampaignAnalyticsDocument>,
    private recipientService: RecipientService,
    private templateService: TemplateService,
    private emailService: EmailService,
  ) {}

  async create(createCampaignDto: CreateCampaignDto, userId: string) {
    try {
      // Calculate recipient count if filters are provided
      let recipientCount = 0;
      if (createCampaignDto.recipientFilters || createCampaignDto.recipientEmails) {
        const recipients = await this.recipientService.getFilteredRecipients(
          createCampaignDto.recipientFilters || {},
          createCampaignDto.recipientEmails,
        );
        recipientCount = recipients.count;
      }

      const campaign = new this.campaignModel({
        ...createCampaignDto,
        recipientCount,
        createdBy: new Types.ObjectId(userId),
        status: createCampaignDto.scheduledDate 
          ? CampaignStatus.SCHEDULED 
          : CampaignStatus.DRAFT,
      });

      const savedCampaign = await campaign.save();
      this.logger.log(`Campaign created: ${savedCampaign._id}`);
      return savedCampaign;
    } catch (error) {
      this.logger.error('Error creating campaign:', error);
      throw error;
    }
  }

  async findAll(
    userId?: string,
    filters?: {
      status?: CampaignStatus;
      type?: CampaignType;
      startDate?: Date;
      endDate?: Date;
    },
    pagination?: { page: number; limit: number },
  ) {
    const query: any = {};

    if (userId) {
      query.createdBy = new Types.ObjectId(userId);
    }

    if (filters?.status) {
      query.status = filters.status;
    }

    if (filters?.type) {
      query.type = filters.type;
    }

    if (filters?.startDate || filters?.endDate) {
      query.createdAt = {};
      if (filters.startDate) {
        query.createdAt.$gte = filters.startDate;
      }
      if (filters.endDate) {
        query.createdAt.$lte = filters.endDate;
      }
    }

    const page = pagination?.page || 1;
    const limit = pagination?.limit || 20;
    const skip = (page - 1) * limit;

    const [campaigns, total] = await Promise.all([
      this.campaignModel
        .find(query)
        .populate('createdBy', 'firstName lastName email')
        .populate('templateId', 'name category')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      this.campaignModel.countDocuments(query),
    ]);

    return {
      campaigns,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string) {
    const campaign = await this.campaignModel
      .findById(id)
      .populate('createdBy', 'firstName lastName email')
      .populate('templateId', 'name category htmlContent jsonConfig');

    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }

    return campaign;
  }

  async update(id: string, updateCampaignDto: UpdateCampaignDto, userId: string) {
    const campaign = await this.findOne(id);

    if (campaign.status === CampaignStatus.SENT) {
      throw new BadRequestException('Cannot update a sent campaign');
    }

    // Recalculate recipient count if filters changed
    if (updateCampaignDto.recipientFilters || updateCampaignDto.recipientEmails) {
      const recipients = await this.recipientService.getFilteredRecipients(
        updateCampaignDto.recipientFilters || {},
        updateCampaignDto.recipientEmails,
      );
      updateCampaignDto['recipientCount'] = recipients.count;
    }

    const updated = await this.campaignModel.findByIdAndUpdate(
      id,
      {
        ...updateCampaignDto,
        lastModifiedBy: new Types.ObjectId(userId),
      },
      { new: true },
    );

    this.logger.log(`Campaign updated: ${id}`);
    return updated;
  }

  async delete(id: string) {
    const campaign = await this.findOne(id);

    if (campaign.status === CampaignStatus.SENDING || campaign.status === CampaignStatus.SENT) {
      throw new BadRequestException('Cannot delete a campaign that is sending or has been sent');
    }

    await this.campaignModel.findByIdAndDelete(id);
    this.logger.log(`Campaign deleted: ${id}`);
  }

  async sendTestEmail(sendTestEmailDto: SendTestEmailDto) {
    const campaign = await this.findOne(sendTestEmailDto.campaignId);

    if (!campaign.htmlContent && !campaign.templateId) {
      throw new BadRequestException('Campaign must have content or a template');
    }

    let htmlContent = campaign.htmlContent;
    
    if (campaign.templateId) {
      const template = await this.templateService.findOne(campaign.templateId.toString());
      htmlContent = template.htmlContent;
    }

    // Replace variables with test data
    const testData = sendTestEmailDto.testData || {
      firstName: 'Test',
      lastName: 'User',
      email: 'test@example.com',
    };

    htmlContent = this.replaceVariables(htmlContent, testData);

    // Send test emails
    const results = await Promise.allSettled(
      sendTestEmailDto.testEmails.map((email) =>
        this.emailService.sendBasicEmail(
          email,
          `[TEST] ${campaign.subject}`,
          htmlContent,
        ),
      ),
    );

    // Update campaign with test emails
    await this.campaignModel.findByIdAndUpdate(sendTestEmailDto.campaignId, {
      $addToSet: { testEmails: { $each: sendTestEmailDto.testEmails } },
    });

    return {
      success: results.filter((r) => r.status === 'fulfilled').length,
      failed: results.filter((r) => r.status === 'rejected').length,
      results,
    };
  }

  async sendCampaign(id: string, userId: string) {
    const campaign = await this.findOne(id);

    if (campaign.status === CampaignStatus.SENT) {
      throw new BadRequestException('Campaign has already been sent');
    }

    if (!campaign.recipientFilters && !campaign.recipientEmails?.length) {
      throw new BadRequestException('Campaign must have recipients');
    }

    if (!campaign.htmlContent && !campaign.templateId) {
      throw new BadRequestException('Campaign must have content or a template');
    }

    // Update status to sending
    await this.campaignModel.findByIdAndUpdate(id, {
      status: CampaignStatus.SENDING,
    });

    try {
      // Get recipients
      const recipients = await this.recipientService.getFilteredRecipients(
        campaign.recipientFilters || {},
        campaign.recipientEmails,
      );

      let htmlContent = campaign.htmlContent;
      
      if (campaign.templateId) {
        const template = await this.templateService.findOne(campaign.templateId.toString());
        htmlContent = template.htmlContent;
      }

      // Send emails in batches
      const batchSize = 50;
      let sent = 0;
      let failed = 0;

      for (let i = 0; i < recipients.emails.length; i += batchSize) {
        const batch = recipients.emails.slice(i, i + batchSize);
        
        const results = await Promise.allSettled(
          batch.map(async (recipient) => {
            const personalizedContent = this.replaceVariables(htmlContent, {
              firstName: recipient.firstName || '',
              lastName: recipient.lastName || '',
              email: recipient.email,
              ...recipient,
            });

            // Send email via Brevo
            await this.emailService.sendBasicEmail(
              recipient.email,
              campaign.subject,
              personalizedContent,
            );

            // Create analytics entry
            await this.analyticsModel.create({
              campaignId: campaign._id,
              recipientEmail: recipient.email,
              userId: recipient._id,
              delivered: true,
              deliveredAt: new Date(),
            });
          }),
        );

        sent += results.filter((r) => r.status === 'fulfilled').length;
        failed += results.filter((r) => r.status === 'rejected').length;

        // Update progress
        await this.campaignModel.findByIdAndUpdate(id, {
          'analytics.sent': sent,
        });
      }

      // Update campaign status and analytics
      await this.campaignModel.findByIdAndUpdate(id, {
        status: CampaignStatus.SENT,
        sentDate: new Date(),
        'analytics.sent': sent,
        'analytics.delivered': sent,
      });

      this.logger.log(`Campaign sent: ${id}, Recipients: ${sent}, Failed: ${failed}`);
      
      return {
        success: true,
        sent,
        failed,
      };
    } catch (error) {
      // Update status to failed
      await this.campaignModel.findByIdAndUpdate(id, {
        status: CampaignStatus.FAILED,
        error: {
          message: error.message,
          timestamp: new Date(),
          details: error,
        },
      });

      this.logger.error(`Campaign send failed: ${id}`, error);
      throw error;
    }
  }

  async scheduleCampaign(id: string, scheduledDate: Date, userId: string) {
    const campaign = await this.findOne(id);

    if (campaign.status === CampaignStatus.SENT) {
      throw new BadRequestException('Cannot schedule a sent campaign');
    }

    if (scheduledDate <= new Date()) {
      throw new BadRequestException('Scheduled date must be in the future');
    }

    await this.campaignModel.findByIdAndUpdate(id, {
      scheduledDate,
      status: CampaignStatus.SCHEDULED,
      lastModifiedBy: new Types.ObjectId(userId),
    });

    this.logger.log(`Campaign scheduled: ${id} for ${scheduledDate}`);
    return { success: true, scheduledDate };
  }

  async cancelCampaign(id: string, userId: string) {
    const campaign = await this.findOne(id);

    if (campaign.status === CampaignStatus.SENT) {
      throw new BadRequestException('Cannot cancel a sent campaign');
    }

    if (campaign.status === CampaignStatus.SENDING) {
      throw new BadRequestException('Cannot cancel a campaign that is currently sending');
    }

    await this.campaignModel.findByIdAndUpdate(id, {
      status: CampaignStatus.CANCELLED,
      lastModifiedBy: new Types.ObjectId(userId),
    });

    this.logger.log(`Campaign cancelled: ${id}`);
    return { success: true };
  }

  async duplicateCampaign(id: string, userId: string) {
    const campaign = await this.findOne(id);

    const newCampaign = new this.campaignModel({
      name: `${campaign.name} (Copy)`,
      subject: campaign.subject,
      previewText: campaign.previewText,
      type: campaign.type,
      status: CampaignStatus.DRAFT,
      templateId: campaign.templateId,
      htmlContent: campaign.htmlContent,
      jsonContent: campaign.jsonContent,
      recipientFilters: campaign.recipientFilters,
      recipientEmails: campaign.recipientEmails,
      recipientCount: campaign.recipientCount,
      createdBy: new Types.ObjectId(userId),
      abTesting: campaign.abTesting,
      metadata: campaign.metadata,
    });

    const saved = await newCampaign.save();
    this.logger.log(`Campaign duplicated: ${id} -> ${saved._id}`);
    return saved;
  }

  // Process scheduled campaigns (runs every minute)
  @Cron('*/1 * * * *')
  async processScheduledCampaigns() {
    const now = new Date();
    
    const campaigns = await this.campaignModel.find({
      status: CampaignStatus.SCHEDULED,
      scheduledDate: { $lte: now },
    });

    for (const campaign of campaigns) {
      try {
        this.logger.log(`Processing scheduled campaign: ${campaign._id}`);
        await this.sendCampaign(campaign._id.toString(), campaign.createdBy.toString());
      } catch (error) {
        this.logger.error(`Failed to send scheduled campaign: ${campaign._id}`, error);
      }
    }
  }

  private replaceVariables(content: string, data: Record<string, any>): string {
    return content.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return data[key] || match;
    });
  }
}