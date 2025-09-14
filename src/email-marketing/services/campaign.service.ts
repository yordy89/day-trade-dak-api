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
import { UnsubscribedEmail } from '../schemas/unsubscribed-email.schema';
import { User } from '../../users/user.schema';
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
    @InjectModel(UnsubscribedEmail.name)
    private unsubscribedEmailModel: Model<UnsubscribedEmail>,
    @InjectModel(User.name)
    private userModel: Model<User>,
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

    // Only prevent deletion if campaign is currently sending
    if (campaign.status === CampaignStatus.SENDING) {
      throw new BadRequestException('Cannot delete a campaign that is currently being sent. Please wait for it to complete.');
    }

    // Delete all associated analytics data if campaign was sent
    if (campaign.status === CampaignStatus.SENT) {
      await this.analyticsModel.deleteMany({ campaignId: id });
      this.logger.log(`Deleted analytics for campaign: ${id}`);
    }

    await this.campaignModel.findByIdAndDelete(id);
    this.logger.log(`Campaign deleted: ${id}`);
    
    return { success: true, message: 'Campaign deleted successfully' };
  }

  async sendTestEmail(sendTestEmailDto: SendTestEmailDto) {
    const campaign = await this.findOne(sendTestEmailDto.campaignId);

    if (!campaign.htmlContent && !campaign.templateId) {
      throw new BadRequestException('Campaign must have content or a template');
    }

    let htmlContent = campaign.htmlContent;
    
    if (campaign.templateId) {
      // Check if templateId is populated (has htmlContent property) or just an ID
      const templateIdAny = campaign.templateId as any;
      
      if (templateIdAny.htmlContent) {
        // Template is already populated
        htmlContent = templateIdAny.htmlContent;
      } else {
        // Template is just an ID, need to fetch it
        const templateId = templateIdAny._id?.toString() || templateIdAny.toString();
        const template = await this.templateService.findOne(templateId);
        htmlContent = template.htmlContent;
      }
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
      sendTestEmailDto.testEmails.map(async (email) => {
        // Add tracking to test emails too
        const trackedContent = this.addEmailTracking(
          htmlContent,
          campaign._id.toString(),
          email,
        );
        
        // Send the email
        await this.emailService.sendBasicEmail(
          email,
          `[TEST] ${campaign.subject}`,
          trackedContent,
        );
        
        // Create or update analytics entry for test email
        try {
          await this.analyticsModel.findOneAndUpdate(
            {
              campaignId: campaign._id,
              recipientEmail: email,
            },
            {
              $set: {
                sent: true,
                sentAt: new Date(),
                isTestEmail: true,
              },
              $setOnInsert: {
                delivered: false,
                opened: false,
                clicked: false,
                bounced: false,
                unsubscribed: false,
                openCount: 0,
                clickCount: 0,
              }
            },
            {
              new: true,
              upsert: true,
            }
          );
          
          this.logger.log(`Created/Updated analytics entry for test email: ${email} - Campaign: ${campaign._id}`);
        } catch (error) {
          this.logger.error(`Failed to create test email analytics: ${error.message}`);
        }
      }),
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

      this.logger.log(`Initial recipients for campaign ${id}: ${recipients.count}`);
      
      // Filter out unsubscribed emails
      const unsubscribedEmails = await this.unsubscribedEmailModel
        .find({ isActive: true })
        .select('email')
        .lean();
      
      const unsubscribedSet = new Set(
        unsubscribedEmails.map(u => u.email.toLowerCase())
      );
      
      // Also check user preferences for registered users
      const usersWithOptOut = await this.userModel
        .find({
          $or: [
            { 'emailPreferences.marketing': false },
            { 'emailPreferences.newsletter': false },
            { 'emailPreferences.events': false },
            { 'emailPreferences.promotional': false },
          ]
        })
        .select('email')
        .lean();
      
      usersWithOptOut.forEach(user => {
        if (user.email) {
          unsubscribedSet.add(user.email.toLowerCase());
        }
      });
      
      // Filter recipients
      const filteredRecipients = recipients.emails.filter(
        r => !unsubscribedSet.has(r.email?.toLowerCase())
      );
      
      const removedCount = recipients.emails.length - filteredRecipients.length;
      if (removedCount > 0) {
        this.logger.log(`Removed ${removedCount} unsubscribed emails from campaign ${id}`);
      }
      
      this.logger.log(`Sending campaign ${id} to ${filteredRecipients.length} recipients (after filtering)`);
      
      // Store the actual recipient emails and initialize recipients array
      const recipientEmailsList = filteredRecipients.map(r => r.email);
      const recipientsData = filteredRecipients.map(r => ({
        email: r.email,
        sent: false,
        delivered: false,
        opened: false,
        openCount: 0,
        clicked: false,
        clickCount: 0,
        bounced: false,
        unsubscribed: false,
      }));
      
      await this.campaignModel.findByIdAndUpdate(id, {
        recipientEmails: recipientEmailsList,
        recipients: recipientsData,
        recipientCount: filteredRecipients.length,
      });

      let htmlContent = campaign.htmlContent;
      
      if (campaign.templateId) {
        // Check if templateId is populated (has htmlContent property) or just an ID
        const templateIdAny = campaign.templateId as any;
        
        if (templateIdAny.htmlContent) {
          // Template is already populated
          htmlContent = templateIdAny.htmlContent;
        } else {
          // Template is just an ID, need to fetch it
          const templateId = templateIdAny._id?.toString() || templateIdAny.toString();
          const template = await this.templateService.findOne(templateId);
          htmlContent = template.htmlContent;
        }
      }

      // Send emails in batches
      const batchSize = 50;
      let sent = 0;
      let failed = 0;

      for (let i = 0; i < filteredRecipients.length; i += batchSize) {
        const batch = filteredRecipients.slice(i, i + batchSize);
        
        const results = await Promise.allSettled(
          batch.map(async (recipient) => {
            let personalizedContent = this.replaceVariables(htmlContent, {
              firstName: recipient.firstName || '',
              lastName: recipient.lastName || '',
              email: recipient.email,
              ...recipient,
            });

            // Add tracking to the email content
            personalizedContent = this.addEmailTracking(
              personalizedContent,
              campaign._id.toString(),
              recipient.email,
            );

            // Log tracking status
            this.logger.log(`Sending to ${recipient.email} with tracking:`, {
              hasPixel: personalizedContent.includes('/tracking/open/'),
              hasTrackedLinks: personalizedContent.includes('/tracking/click/'),
              contentLength: personalizedContent.length
            });
            
            // Send email via Brevo
            await this.emailService.sendBasicEmail(
              recipient.email,
              campaign.subject,
              personalizedContent,
            );

            // Update recipient status in campaign document
            try {
              const now = new Date();
              await this.campaignModel.updateOne(
                { 
                  _id: campaign._id,
                  'recipients.email': recipient.email 
                },
                {
                  $set: {
                    'recipients.$.sent': true,
                    'recipients.$.sentAt': now,
                    'recipients.$.delivered': true,
                    'recipients.$.deliveredAt': now,
                  }
                }
              );
              
              this.logger.log(`Updated recipient status for ${recipient.email} - Campaign: ${campaign._id}`);
              
              // Also create/update analytics entry for backward compatibility
              await this.analyticsModel.findOneAndUpdate(
                {
                  campaignId: campaign._id,
                  recipientEmail: recipient.email,
                },
                {
                  $set: {
                    userId: recipient._id,
                    sent: true,
                    sentAt: now,
                    delivered: true,
                    deliveredAt: now,
                  },
                  $setOnInsert: {
                    opened: false,
                    clicked: false,
                    bounced: false,
                    unsubscribed: false,
                    openCount: 0,
                    clickCount: 0,
                  }
                },
                {
                  new: true,
                  upsert: true,
                }
              );
            } catch (analyticsError) {
              this.logger.error(`Failed to update recipient status for ${recipient.email}: ${analyticsError.message}`);
              // Don't fail the email send if analytics update fails
            }
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
      // Note: We're not storing the tracked HTML to avoid bloat, 
      // but tracking is added during send
      await this.campaignModel.findByIdAndUpdate(id, {
        status: CampaignStatus.SENT,
        sentDate: new Date(),
        'analytics.sent': sent,
        'analytics.delivered': sent,
        'analytics.opened': 0,
        'analytics.clicked': 0,
        'analytics.bounced': 0,
        'analytics.unsubscribed': 0,
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

  private addEmailTracking(htmlContent: string, campaignId: string, recipientEmail: string): string {
    // Use local URL for development, production URL for production
    const apiUrl = process.env.API_URL || 'http://localhost:4000';
    const baseUrl = `${apiUrl}/api/v1`;
    const encodedEmail = encodeURIComponent(recipientEmail);
    
    this.logger.log(`Adding email tracking - Campaign: ${campaignId}, Recipient: ${recipientEmail}`);
    this.logger.log(`Using API URL: ${apiUrl}, Base URL: ${baseUrl}`);
    
    // Add tracking pixel for open tracking
    // The pixel is a 1x1 transparent image that loads when the email is opened
    const trackingPixel = `<img src="${baseUrl}/email-marketing/tracking/open/${campaignId}/${encodedEmail}.png" width="1" height="1" style="display:block;border:0;" alt="" />`;
    
    // Add the tracking pixel before the closing body tag
    let trackedContent = htmlContent;
    if (htmlContent.includes('</body>')) {
      trackedContent = htmlContent.replace('</body>', `${trackingPixel}</body>`);
    } else {
      // If no body tag, add at the end
      trackedContent = htmlContent + trackingPixel;
    }
    
    // Wrap all links for click tracking
    // Find all href links and wrap them with our tracking URL
    let linkCount = 0;
    trackedContent = trackedContent.replace(
      /href="([^"]+)"/g,
      (match, url) => {
        // Don't track unsubscribe links, already tracked links, or mailto links
        if (url.includes('unsubscribe') || url.includes('/tracking/') || url.startsWith('mailto:')) {
          return match;
        }
        
        // Create tracked URL
        const encodedUrl = encodeURIComponent(url);
        const linkId = this.generateLinkId(url);
        const trackedUrl = `${baseUrl}/email-marketing/tracking/click/${campaignId}/${encodedEmail}?url=${encodedUrl}&linkId=${linkId}`;
        
        linkCount++;
        this.logger.log(`Tracking link #${linkCount}: ${url} -> ${trackedUrl}`);
        
        return `href="${trackedUrl}"`;
      }
    );
    
    // Add unsubscribe link if not present
    if (!trackedContent.includes('unsubscribe')) {
      const unsubscribeUrl = `${baseUrl}/email-marketing/tracking/unsubscribe/${campaignId}/${encodedEmail}`;
      const unsubscribeLink = `<div style="text-align:center;margin-top:20px;font-size:12px;color:#666;">
        <a href="${unsubscribeUrl}" style="color:#666;text-decoration:underline;">Unsubscribe</a>
      </div>`;
      
      if (trackedContent.includes('</body>')) {
        trackedContent = trackedContent.replace('</body>', `${unsubscribeLink}</body>`);
      } else {
        trackedContent = trackedContent + unsubscribeLink;
      }
    }
    
    return trackedContent;
  }

  private generateLinkId(url: string): string {
    // Generate a simple ID based on the URL
    // In production, you might want to use a hash or store link mappings
    return Buffer.from(url).toString('base64').substring(0, 10);
  }
}