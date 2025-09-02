import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CampaignAnalytics } from '../schemas/campaign-analytics.schema';
import { Campaign } from '../schemas/campaign.schema';
import { subDays, startOfDay, endOfDay } from 'date-fns';

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectModel(CampaignAnalytics.name)
    private analyticsModel: Model<CampaignAnalytics>,
    @InjectModel(Campaign.name)
    private campaignModel: Model<Campaign>,
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
    const analytics = await this.analyticsModel
      .find({ campaignId })
      .sort({ createdAt: -1 })
      .exec();

    const summary = {
      sent: analytics.length,
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