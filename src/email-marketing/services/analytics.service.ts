import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CampaignAnalytics } from '../schemas/campaign-analytics.schema';
import { Campaign } from '../schemas/campaign.schema';
import { UnsubscribedEmail, UnsubscribeReason, UnsubscribeSource } from '../schemas/unsubscribed-email.schema';
import { User } from '../../users/user.schema';
import { subDays, startOfDay, endOfDay } from 'date-fns';

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(
    @InjectModel(CampaignAnalytics.name)
    private analyticsModel: Model<CampaignAnalytics>,
    @InjectModel(Campaign.name)
    private campaignModel: Model<Campaign>,
    @InjectModel(UnsubscribedEmail.name)
    private unsubscribedEmailModel: Model<UnsubscribedEmail>,
    @InjectModel(User.name)
    private userModel: Model<User>,
  ) {}

  async getAnalytics(filters: {
    campaignId?: string;
    timeRange?: string;
    startDate?: Date;
    endDate?: Date;
  }) {
    const query: any = {};

    if (filters.campaignId) {
      query.campaignId = filters.campaignId;
    }

    if (filters.timeRange) {
      const now = new Date();
      let startDate: Date;

      switch (filters.timeRange) {
        case '7d':
          startDate = subDays(now, 7);
          break;
        case '30d':
          startDate = subDays(now, 30);
          break;
        case '90d':
          startDate = subDays(now, 90);
          break;
        default:
          startDate = new Date(0); // All time
      }

      query.createdAt = { $gte: startDate };
    } else if (filters.startDate && filters.endDate) {
      query.createdAt = {
        $gte: startOfDay(new Date(filters.startDate)),
        $lte: endOfDay(new Date(filters.endDate)),
      };
    }

    const analytics = await this.analyticsModel
      .find(query)
      .sort({ createdAt: -1 })
      .populate('campaignId', 'name subject')
      .exec();

    // Calculate aggregated metrics for each campaign
    const campaignMetrics = new Map();

    for (const record of analytics) {
      const campaign = record.campaignId as any;
      const campaignId = campaign._id ? campaign._id.toString() : record.campaignId.toString();
      const campaignName = campaign.name || 'Unknown Campaign';
      
      if (!campaignMetrics.has(campaignId)) {
        campaignMetrics.set(campaignId, {
          _id: campaignId,
          campaignId: campaignId,
          campaignName: campaignName,
          sent: 0,
          delivered: 0,
          opened: 0,
          clicked: 0,
          bounced: 0,
          unsubscribed: 0,
          marked_spam: 0,
          lastUpdated: (record as any).createdAt || new Date(),
        });
      }

      const metrics = campaignMetrics.get(campaignId);
      metrics.sent++;
      if (record.delivered) metrics.delivered++;
      if (record.opened) metrics.opened++;
      if (record.clicked) metrics.clicked++;
      if (record.bounced) metrics.bounced++;
      if (record.unsubscribed) metrics.unsubscribed++;
      if ((record as any).complained) metrics.marked_spam++;
      
      const recordDate = (record as any).updatedAt || (record as any).createdAt || new Date();
      if (recordDate > metrics.lastUpdated) {
        metrics.lastUpdated = recordDate;
      }
    }

    // Calculate rates
    const result = Array.from(campaignMetrics.values()).map(metrics => ({
      ...metrics,
      deliveryRate: metrics.sent > 0 ? (metrics.delivered / metrics.sent) * 100 : 0,
      openRate: metrics.delivered > 0 ? (metrics.opened / metrics.delivered) * 100 : 0,
      clickRate: metrics.opened > 0 ? (metrics.clicked / metrics.opened) * 100 : 0,
      bounceRate: metrics.sent > 0 ? (metrics.bounced / metrics.sent) * 100 : 0,
      unsubscribeRate: metrics.delivered > 0 ? (metrics.unsubscribed / metrics.delivered) * 100 : 0,
    }));

    return result;
  }

  async getCampaignAnalytics(campaignId: string) {
    // First, get the campaign with recipients data
    const campaign = await this.campaignModel.findById(campaignId).exec();
    
    if (campaign) {
      this.logger.log(`Campaign found: ${campaign.name}, Recipients: ${campaign.recipients?.length || campaign.recipientEmails?.length || 0}`);
      
      // If campaign has recipients array with analytics, use that
      if (campaign.recipients && campaign.recipients.length > 0) {
        const recipients = campaign.recipients;
        
        const summary = {
          sent: recipients.filter(r => r.sent).length,
          delivered: recipients.filter(r => r.delivered).length,
          opened: recipients.filter(r => r.opened).length,
          clicked: recipients.filter(r => r.clicked).length,
          bounced: recipients.filter(r => r.bounced).length,
          unsubscribed: recipients.filter(r => r.unsubscribed).length,
          marked_spam: 0, // We don't track this in the new structure yet
        };
        
        this.logger.log(`Using embedded recipients data - Summary: ${JSON.stringify(summary)}`);
        
        return {
          summary,
          deliveryRate: summary.sent > 0 ? (summary.delivered / summary.sent) * 100 : 0,
          openRate: summary.delivered > 0 ? (summary.opened / summary.delivered) * 100 : 0,
          clickRate: summary.opened > 0 ? (summary.clicked / summary.opened) * 100 : 0,
          bounceRate: summary.sent > 0 ? (summary.bounced / summary.sent) * 100 : 0,
          unsubscribeRate: summary.delivered > 0 ? (summary.unsubscribed / summary.delivered) * 100 : 0,
          recipients: recipients.map(r => ({
            recipientEmail: r.email,
            sent: r.sent,
            sentAt: r.sentAt,
            delivered: r.delivered,
            deliveredAt: r.deliveredAt,
            opened: r.opened,
            firstOpenedAt: r.openedAt,
            openCount: r.openCount,
            clicked: r.clicked,
            firstClickedAt: r.clickedAt,
            clickCount: r.clickCount,
            bounced: r.bounced,
            unsubscribed: r.unsubscribed,
          })),
        };
      }
    }
    
    // Convert string to ObjectId for querying
    const campaignObjectId = Types.ObjectId.isValid(campaignId) 
      ? new Types.ObjectId(campaignId) 
      : campaignId;
    
    this.logger.log(`Querying analytics for campaign: ${campaignId} (as ${campaignObjectId})`);
    
    const analytics = await this.analyticsModel
      .find({ campaignId: campaignObjectId })
      .populate('userId', 'firstName lastName email')
      .sort({ createdAt: -1 })
      .exec();

    this.logger.log(`Found ${analytics.length} analytics records for campaign: ${campaignId}`);
    
    // Also try with string campaignId if ObjectId query returns nothing
    if (analytics.length === 0) {
      this.logger.log(`No records found with ObjectId, trying with string campaignId: ${campaignId}`);
      const analyticsWithString = await this.analyticsModel
        .find({ campaignId: campaignId })
        .populate('userId', 'firstName lastName email')
        .sort({ createdAt: -1 })
        .exec();
      
      if (analyticsWithString.length > 0) {
        this.logger.log(`Found ${analyticsWithString.length} records with string campaignId`);
        analytics.push(...analyticsWithString);
      }
    }
    
    // If still no analytics records but campaign has recipientEmails, create basic records
    if (analytics.length === 0 && campaign && campaign.recipientEmails?.length > 0) {
      this.logger.log(`No analytics records found, creating from campaign recipientEmails`);
      
      // Create analytics records for each recipient email
      const createdAnalytics = [];
      for (const email of campaign.recipientEmails) {
        try {
          const newAnalytics = await this.analyticsModel.findOneAndUpdate(
            { 
              campaignId: campaignObjectId, 
              recipientEmail: email 
            },
            {
              $setOnInsert: {
                campaignId: campaignObjectId,
                recipientEmail: email,
                sent: true,
                sentAt: campaign.sentDate || new Date(),
                delivered: true,
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
              setDefaultsOnInsert: true
            }
          ).populate('userId', 'firstName lastName email').exec();
          
          createdAnalytics.push(newAnalytics);
        } catch (error) {
          this.logger.error(`Error creating analytics for ${email}: ${error.message}`);
        }
      }
      
      analytics.push(...createdAnalytics);
      this.logger.log(`Created ${createdAnalytics.length} analytics records`);
    }

    const summary = {
      sent: analytics.filter(a => a.sent || a.delivered).length, // Count as sent if either sent or delivered
      delivered: analytics.filter(a => a.delivered).length,
      opened: analytics.filter(a => a.opened).length,
      clicked: analytics.filter(a => a.clicked).length,
      bounced: analytics.filter(a => a.bounced).length,
      unsubscribed: analytics.filter(a => a.unsubscribed).length,
      marked_spam: analytics.filter(a => (a as any).complained).length,
    };

    return {
      summary,
      deliveryRate: summary.sent > 0 ? (summary.delivered / summary.sent) * 100 : 0,
      openRate: summary.delivered > 0 ? (summary.opened / summary.delivered) * 100 : 0,
      clickRate: summary.opened > 0 ? (summary.clicked / summary.opened) * 100 : 0,
      bounceRate: summary.sent > 0 ? (summary.bounced / summary.sent) * 100 : 0,
      unsubscribeRate: summary.delivered > 0 ? (summary.unsubscribed / summary.delivered) * 100 : 0,
      recipients: analytics,
    };
  }

  async trackEmail(campaignId: string, recipientEmail: string) {
    const analytics = new this.analyticsModel({
      campaignId,
      recipientEmail,
      sent: true,
      sentAt: new Date(),
    });

    return analytics.save();
  }

  async updateEmailStatus(
    campaignId: string,
    recipientEmail: string,
    status: Partial<CampaignAnalytics>,
  ) {
    return this.analyticsModel.findOneAndUpdate(
      { campaignId, recipientEmail },
      { $set: status },
      { new: true, upsert: true },
    );
  }

  async exportAnalytics(filters: any, format: 'csv' | 'json' = 'csv') {
    const analytics = await this.getAnalytics(filters);

    if (format === 'json') {
      return analytics;
    }

    // Generate CSV
    const headers = [
      'Campaign Name',
      'Sent',
      'Delivered',
      'Delivery Rate',
      'Opened',
      'Open Rate',
      'Clicked',
      'Click Rate',
      'Bounced',
      'Bounce Rate',
      'Unsubscribed',
      'Unsubscribe Rate',
      'Last Updated',
    ];

    const rows = analytics.map(a => [
      a.campaignName,
      a.sent,
      a.delivered,
      `${a.deliveryRate.toFixed(2)}%`,
      a.opened,
      `${a.openRate.toFixed(2)}%`,
      a.clicked,
      `${a.clickRate.toFixed(2)}%`,
      a.bounced,
      `${a.bounceRate.toFixed(2)}%`,
      a.unsubscribed,
      `${a.unsubscribeRate.toFixed(2)}%`,
      new Date(a.lastUpdated).toISOString(),
    ]);

    const csv = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
    ].join('\n');

    return csv;
  }

  async trackEmailOpen(campaignId: string, recipientEmail: string) {
    try {
      this.logger.log(`[trackEmailOpen] Starting for campaign: ${campaignId}, email: ${recipientEmail}`);
      
      // First check if analytics record exists
      let analyticsRecord = await this.analyticsModel.findOne({
        campaignId,
        recipientEmail
      });
      
      const isFirstOpen = !analyticsRecord?.opened;
      
      // Update or create analytics record
      analyticsRecord = await this.analyticsModel.findOneAndUpdate(
        { campaignId, recipientEmail },
        { 
          $set: { 
            opened: true,
            firstOpenedAt: isFirstOpen ? new Date() : analyticsRecord?.firstOpenedAt,
            delivered: true, // If email is opened, it was delivered
          },
          $inc: { openCount: 1 },
          $setOnInsert: {
            sent: true,
            sentAt: new Date(),
            deliveredAt: new Date(),
          }
        },
        { 
          new: true, 
          upsert: true 
        },
      );
      
      this.logger.log(`[trackEmailOpen] Analytics record updated - opened: ${analyticsRecord.opened}, openCount: ${analyticsRecord.openCount}`);
      
      // Update the campaign recipients array
      const campaign = await this.campaignModel.findById(campaignId);
      
      if (campaign && campaign.recipients) {
        const recipientIndex = campaign.recipients.findIndex(r => r.email === recipientEmail);
        
        if (recipientIndex >= 0) {
          // Update existing recipient
          await this.campaignModel.updateOne(
            { 
              _id: campaignId,
              'recipients.email': recipientEmail 
            },
            {
              $set: {
                'recipients.$.opened': true,
                'recipients.$.openedAt': isFirstOpen ? new Date() : campaign.recipients[recipientIndex].openedAt,
                'recipients.$.delivered': true, // Mark as delivered if opened
              },
              $inc: {
                'recipients.$.openCount': 1
              }
            }
          );
          
          this.logger.log(`[trackEmailOpen] Updated recipient in campaign.recipients array`);
        } else {
          // Recipient not in array, add them
          await this.campaignModel.updateOne(
            { _id: campaignId },
            {
              $push: {
                recipients: {
                  email: recipientEmail,
                  sent: true,
                  sentAt: new Date(),
                  delivered: true,
                  deliveredAt: new Date(),
                  opened: true,
                  openedAt: new Date(),
                  openCount: 1,
                  clicked: false,
                  clickCount: 0,
                  bounced: false,
                  unsubscribed: false,
                }
              }
            }
          );
          
          this.logger.log(`[trackEmailOpen] Added new recipient to campaign.recipients array`);
        }
      }
      
      // Update global campaign analytics if first open
      if (isFirstOpen) {
        await this.campaignModel.updateOne(
          { _id: campaignId },
          { $inc: { 'analytics.opened': 1 } }
        );
        
        this.logger.log(`[trackEmailOpen] Incremented campaign.analytics.opened`);
      }
      
      this.logger.log(`[trackEmailOpen] Completed - First Open: ${isFirstOpen}`);
    } catch (error) {
      this.logger.error(`Error tracking email open: ${error.message}`);
      this.logger.error(`Error details:`, error);
    }
  }

  async trackEmailClick(campaignId: string, recipientEmail: string, linkId?: string) {
    try {
      // First, update the recipient in the campaign document
      const campaign = await this.campaignModel.findOne({
        _id: campaignId,
        'recipients.email': recipientEmail
      });
      
      if (campaign) {
        const recipient = campaign.recipients?.find(r => r.email === recipientEmail);
        const isFirstClick = !recipient?.clicked;
        
        // Update recipient in campaign document
        await this.campaignModel.updateOne(
          { 
            _id: campaignId,
            'recipients.email': recipientEmail 
          },
          {
            $set: {
              'recipients.$.clicked': true,
              'recipients.$.clickedAt': new Date(),
            },
            $inc: {
              'recipients.$.clickCount': 1
            }
          }
        );
        
        // Update global campaign analytics if first click
        if (isFirstClick) {
          await this.campaignModel.updateOne(
            { _id: campaignId },
            { $inc: { 'analytics.clicked': 1 } }
          );
        }
        
        this.logger.log(`Link clicked - Campaign: ${campaignId}, Recipient: ${recipientEmail}, Link: ${linkId}, First Click: ${isFirstClick}`);
      }
      
      // Also update analytics collection for backward compatibility
      const update: any = {
        $set: { 
          clicked: true,
          firstClickedAt: new Date(),
        },
        $inc: { clickCount: 1 },
        $setOnInsert: {
          sent: true,
          sentAt: new Date(),
          delivered: true,
          deliveredAt: new Date(),
        }
      };

      if (linkId) {
        update.$push = { clickedLinks: { linkId, clickedAt: new Date() } };
      }

      const result = await this.analyticsModel.findOneAndUpdate(
        { campaignId, recipientEmail },
        update,
        { 
          new: true, 
          upsert: true 
        },
      );
      
      this.logger.log(`Analytics collection updated: ${result ? result._id : 'No result'}, ClickCount: ${result?.clickCount}`);
    } catch (error) {
      this.logger.error(`Error tracking email click: ${error.message}`);
      this.logger.error(`Error details:`, error);
    }
  }

  async trackEmailUnsubscribe(
    campaignId: string, 
    recipientEmail: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    try {
      const now = new Date();
      const emailLower = recipientEmail.toLowerCase().trim();
      
      // 1. Update campaign analytics
      await this.analyticsModel.findOneAndUpdate(
        { campaignId, recipientEmail: emailLower },
        { 
          $set: { 
            unsubscribed: true,
            unsubscribedAt: now,
          },
          $setOnInsert: {
            sent: true,
            sentAt: now,
          }
        },
        { 
          new: true, 
          upsert: true 
        },
      );
      
      // 2. Add to global unsubscribe list
      const existingUnsubscribe = await this.unsubscribedEmailModel.findOne({
        email: emailLower,
        isActive: true,
      });
      
      if (!existingUnsubscribe) {
        // Find user by email if exists
        const user = await this.userModel.findOne({ email: emailLower });
        
        await this.unsubscribedEmailModel.create({
          email: emailLower,
          userId: user?._id,
          campaignId: new Types.ObjectId(campaignId),
          reason: UnsubscribeReason.USER_REQUEST,
          source: UnsubscribeSource.EMAIL_LINK,
          unsubscribedAt: now,
          ipAddress,
          userAgent,
          isActive: true,
        });
        
        this.logger.log(`Added ${emailLower} to global unsubscribe list`);
      }
      
      // 3. Update user preferences if user exists
      const user = await this.userModel.findOne({ email: emailLower });
      if (user) {
        await this.userModel.updateOne(
          { _id: user._id },
          {
            $set: {
              'emailPreferences.marketing': false,
              'emailPreferences.newsletter': false,
              'emailPreferences.events': false,
              'emailPreferences.educational': false,
              'emailPreferences.promotional': false,
              'emailPreferences.unsubscribedAt': now,
              // Note: transactional emails remain true for important notifications
            }
          }
        );
        
        this.logger.log(`Updated email preferences for user: ${user._id}`);
      }
      
      // 4. Update campaign statistics
      await this.campaignModel.updateOne(
        { _id: campaignId },
        { 
          $inc: { 
            'analytics.unsubscribed': 1,
          }
        }
      );
      
      // 5. Update recipient status in campaign if exists
      const campaign = await this.campaignModel.findById(campaignId);
      if (campaign?.recipients) {
        const recipientIndex = campaign.recipients.findIndex(
          r => r.email?.toLowerCase() === emailLower
        );
        
        if (recipientIndex !== -1) {
          await this.campaignModel.updateOne(
            { 
              _id: campaignId,
              'recipients.email': emailLower 
            },
            {
              $set: {
                'recipients.$.unsubscribed': true,
                'recipients.$.unsubscribedAt': now,
              }
            }
          );
        }
      }
      
      this.logger.log(`Complete unsubscribe process for ${emailLower} from campaign ${campaignId}`);
      return { success: true, email: emailLower };
      
    } catch (error) {
      this.logger.error(`Error in complete unsubscribe process: ${error.message}`, error);
      throw error;
    }
  }

  async handleBrevoWebhook(event: string, data: any) {
    const { messageId, email, timestamp } = data;

    switch (event) {
      case 'delivered':
        await this.updateEmailStatus(messageId, email, {
          delivered: true,
          deliveredAt: new Date(timestamp),
        });
        break;

      case 'opened':
        await this.analyticsModel.updateOne(
          { campaignId: messageId, recipientEmail: email },
          { 
            $set: { opened: true, firstOpenedAt: new Date(timestamp) },
            $inc: { openCount: 1 },
          },
        );
        break;

      case 'clicked':
        await this.analyticsModel.updateOne(
          { campaignId: messageId, recipientEmail: email },
          { 
            $set: { clicked: true, firstClickedAt: new Date(timestamp) },
            $inc: { clickCount: 1 },
          },
        );
        break;

      case 'bounced':
        await this.analyticsModel.updateOne(
          { campaignId: messageId, recipientEmail: email },
          { 
            $set: { 
              bounced: true,
              bounceType: 'hard',
              bounceReason: data.reason || 'Unknown'
            }
          },
        );
        break;

      case 'unsubscribed':
        await this.updateEmailStatus(messageId, email, {
          unsubscribed: true,
          unsubscribedAt: new Date(timestamp),
        });
        break;

      case 'marked_as_spam':
        await this.analyticsModel.updateOne(
          { campaignId: messageId, recipientEmail: email },
          { 
            $set: { 
              complained: true,
              complainedAt: new Date(timestamp)
            }
          },
        );
        break;
    }
  }
}