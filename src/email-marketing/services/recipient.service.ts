import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '../../users/user.schema';
import { EventRegistration, EventRegistrationDocument } from '../../event/schemas/eventRegistration.schema';
import { RecipientFilterDto } from '../dto/recipient-filter.dto';
import { RecipientSegment, RecipientSegmentDocument } from '../schemas/recipient-segment.schema';
import { CreateSegmentDto } from '../dto/create-segment.dto';
import { Types } from 'mongoose';
import axios from 'axios';

@Injectable()
export class RecipientService {
  private readonly logger = new Logger(RecipientService.name);
  private readonly brevoApiKey = process.env.BREVO_API_KEY;

  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(EventRegistration.name) 
    private eventRegistrationModel: Model<EventRegistrationDocument>,
    @InjectModel(RecipientSegment.name)
    private segmentModel: Model<RecipientSegmentDocument>,
  ) {}

  async getFilteredRecipients(
    filters: RecipientFilterDto | any,
    additionalEmails?: string[],
  ) {
    try {
      const query: any = {};
      let emails: any[] = [];

      // Log incoming filters for debugging
      this.logger.log('getFilteredRecipients called with filters:', JSON.stringify({
        eventIds: filters.eventIds,
        subscriptions: filters.subscriptions,
        noSubscription: filters.noSubscription,
        countOnly: filters.countOnly,
      }));

      // Check if only event filters are applied (no other user filters)
      const hasUserFilters = filters.subscriptions?.length || 
        filters.noSubscription || 
        filters.status?.length || 
        filters.roles?.length || 
        filters.modulePermissions?.length || 
        filters.lastLoginDays || 
        filters.registrationStartDate || 
        filters.registrationEndDate;

      // Only query users if there are user-specific filters
      if (hasUserFilters) {
        // Apply subscription filters
        if (filters.subscriptions?.length) {
          query['subscriptions.plan'] = { $in: filters.subscriptions };
          query['subscriptions.expiresAt'] = { $gt: new Date() };
        }

        // Filter for users without active subscriptions
        if (filters.noSubscription) {
          query.$or = [
            { subscriptions: { $exists: false } },
            { subscriptions: { $size: 0 } },
            { 'subscriptions.expiresAt': { $lte: new Date() } },
          ];
        }

        // Apply status filters
        if (filters.status?.length) {
          query.status = { $in: filters.status };
        }

        // Apply role filters
        if (filters.roles?.length) {
          query.role = { $in: filters.roles };
        }

        // Apply module permission filters
        if (filters.modulePermissions?.length) {
          const permissionQueries = filters.modulePermissions.map((perm) => ({
            [perm]: true,
          }));
          query.$and = query.$and || [];
          query.$and.push({ $or: permissionQueries });
        }

        // Apply last login filter
        if (filters.lastLoginDays) {
          const cutoffDate = new Date();
          cutoffDate.setDate(cutoffDate.getDate() - filters.lastLoginDays);
          query.lastLogin = { $gte: cutoffDate };
        }

        // Apply registration date range
        if (filters.registrationDateRange || filters.registrationStartDate || filters.registrationEndDate) {
          query.createdAt = {};
          if (filters.registrationDateRange?.start || filters.registrationStartDate) {
            query.createdAt.$gte = new Date(
              filters.registrationDateRange?.start || filters.registrationStartDate
            );
          }
          if (filters.registrationDateRange?.end || filters.registrationEndDate) {
            query.createdAt.$lte = new Date(
              filters.registrationDateRange?.end || filters.registrationEndDate
            );
          }
        }

        // Get users from database
        const users = await this.userModel
          .find(query)
          .select('email firstName lastName subscriptions status role createdAt')
          .lean();

        emails = users.map((user) => ({
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          _id: user._id,
          subscriptions: user.subscriptions,
          status: user.status,
          role: user.role,
        }));
      }

      // Apply event filters
      if (filters.eventIds?.length) {
        // EventId is stored as STRING in the database, not ObjectId!
        // Just use the string IDs directly
        const eventIdStrings = filters.eventIds.map((id: any) => {
          // Convert ObjectId to string if needed, otherwise use as-is
          return typeof id === 'object' && id.toString ? id.toString() : String(id);
        });

        this.logger.log(`Searching for registrations in events (as strings): ${eventIdStrings.join(', ')}`);

        // First, let's check what's in the database with string comparison
        const totalEventRegs = await this.eventRegistrationModel.countDocuments({
          eventId: { $in: eventIdStrings }
        });
        this.logger.log(`Total registrations for these events (any status): ${totalEventRegs}`);

        // Check different payment statuses with string eventId
        const paidRegs = await this.eventRegistrationModel.countDocuments({
          eventId: { $in: eventIdStrings },
          paymentStatus: 'paid'
        });
        const freeRegs = await this.eventRegistrationModel.countDocuments({
          eventId: { $in: eventIdStrings },
          paymentStatus: 'free'
        });
        const pendingRegs = await this.eventRegistrationModel.countDocuments({
          eventId: { $in: eventIdStrings },
          paymentStatus: 'pending'
        });
        
        this.logger.log(`Breakdown - Paid: ${paidRegs}, Free: ${freeRegs}, Pending: ${pendingRegs}`);

        // Now get the actual registrations with string eventId
        const eventRegistrations = await this.eventRegistrationModel
          .find({
            eventId: { $in: eventIdStrings },
            // Only include paid and free registrations for email campaigns
            paymentStatus: { $in: ['paid', 'free'] }
          })
          .select('email firstName lastName userId paymentStatus');
        
        // Log what payment statuses we're seeing
        if (eventRegistrations.length > 0) {
          const statusSample = eventRegistrations.slice(0, 5).map(r => r.paymentStatus || 'null');
          this.logger.log(`Sample payment statuses: ${statusSample.join(', ')}`);
        }

        this.logger.log(`Found ${eventRegistrations.length} event registrations (after filtering)`);

        const eventEmails = eventRegistrations.map((reg) => ({
          email: reg.email,
          firstName: reg.firstName,
          lastName: reg.lastName,
          _id: reg.userId,
        }));

        // Use the same hasUserFilters variable from above for consistency
        if (!hasUserFilters) {
          // If only event filters are applied (no user filters), use only event registrations
          emails = eventEmails;
          this.logger.log(`Using only event registrations: ${eventEmails.length} emails`);
        } else {
          // When combining with other filters, intersect the results
          // Only include users who match both the user filters AND are registered for the events
          const eventEmailSet = new Set(eventEmails.map((e) => e.email));
          emails = emails.filter((e) => eventEmailSet.has(e.email));
          this.logger.log(`Intersecting user and event filters: ${emails.length} emails after intersection`);
        }
      }

      // Get emails from Brevo lists
      if (filters.brevoListIds?.length) {
        const brevoEmails = await this.getEmailsFromBrevoLists(filters.brevoListIds);
        
        // Merge with existing emails
        const emailSet = new Set(emails.map((e) => e.email));
        brevoEmails.forEach((e) => {
          if (!emailSet.has(e.email)) {
            emails.push(e);
            emailSet.add(e.email);
          }
        });
      }

      // Add custom emails
      if (filters.customEmails?.length) {
        const emailSet = new Set(emails.map((e) => e.email));
        filters.customEmails.forEach((email) => {
          if (!emailSet.has(email)) {
            emails.push({ email });
            emailSet.add(email);
          }
        });
      }

      // Add additional emails
      if (additionalEmails?.length) {
        const emailSet = new Set(emails.map((e) => e.email));
        additionalEmails.forEach((email) => {
          if (!emailSet.has(email)) {
            emails.push({ email });
            emailSet.add(email);
          }
        });
      }

      // Exclude emails from specific lists
      if (filters.excludeListIds?.length) {
        const excludeEmails = await this.getEmailsFromBrevoLists(filters.excludeListIds);
        const excludeSet = new Set(excludeEmails.map((e) => e.email));
        emails = emails.filter((e) => !excludeSet.has(e.email));
      }

      // Store total count before pagination
      const totalCount = emails.length;
      
      this.logger.log(`Total recipients found: ${totalCount}, hasUserFilters: ${hasUserFilters}, eventIds: ${filters.eventIds?.length || 0}`);
      
      // Apply pagination if needed
      const offset = filters.offset || 0;
      const limit = filters.limit;
      
      if (limit && !filters.countOnly) {
        emails = emails.slice(offset, offset + limit);
      }

      return {
        emails: filters.countOnly ? [] : emails, // Don't return emails if only counting
        count: totalCount, // Return total count, not paginated count
        query,
      };
    } catch (error) {
      this.logger.error('Error filtering recipients:', error);
      throw error;
    }
  }

  async getBrevoLists(): Promise<any[]> {
    try {
      const response = await axios.get(
        'https://api.brevo.com/v3/contacts/lists',
        {
          headers: {
            'api-key': this.brevoApiKey,
            'Content-Type': 'application/json',
          },
          params: {
            limit: 50,
            offset: 0,
          },
        },
      );

      const lists = response.data.lists || [];
      
      // Get count for each list
      const listsWithCounts = await Promise.all(
        lists.map(async (list) => {
          try {
            const countResponse = await axios.get(
              `https://api.brevo.com/v3/contacts/lists/${list.id}/contacts`,
              {
                headers: {
                  'api-key': this.brevoApiKey,
                  'Content-Type': 'application/json',
                },
                params: {
                  limit: 1,
                },
              },
            );
            
            return {
              id: list.id,
              name: list.name,
              totalSubscribers: countResponse.data.count || 0,
              folderId: list.folderId,
            };
          } catch (error) {
            this.logger.error(`Error getting count for list ${list.id}:`, error);
            return {
              id: list.id,
              name: list.name,
              totalSubscribers: 0,
              folderId: list.folderId,
            };
          }
        }),
      );

      return listsWithCounts;
    } catch (error) {
      this.logger.error('Error fetching Brevo lists:', error);
      return [];
    }
  }

  async getEmailsFromBrevoLists(listIds: number[]): Promise<any[]> {
    try {
      const allContacts = [];

      for (const listId of listIds) {
        let offset = 0;
        let hasMore = true;
        
        while (hasMore) {
          const response = await axios.get(
            `https://api.brevo.com/v3/contacts/lists/${listId}/contacts`,
            {
              headers: {
                'api-key': this.brevoApiKey,
                'Content-Type': 'application/json',
              },
              params: {
                limit: 500,
                offset: offset,
              },
            },
          );

          const contacts = response.data.contacts || [];
          allContacts.push(
            ...contacts.map((c) => ({
              email: c.email,
              firstName: c.attributes?.FIRSTNAME,
              lastName: c.attributes?.LASTNAME,
            })),
          );
          
          // Check if there are more contacts to fetch
          if (contacts.length < 500) {
            hasMore = false;
          } else {
            offset += 500;
          }
          
          // Safety limit to prevent infinite loops
          if (offset > 10000) {
            this.logger.warn(`Reached safety limit for list ${listId}`);
            hasMore = false;
          }
        }
      }

      return allContacts;
    } catch (error) {
      this.logger.error('Error fetching contacts from Brevo:', error);
      return [];
    }
  }

  async createSegment(createSegmentDto: CreateSegmentDto, userId: string) {
    // Calculate initial count
    const recipients = await this.getFilteredRecipients(createSegmentDto.filters);

    const segment = new this.segmentModel({
      ...createSegmentDto,
      estimatedCount: recipients.count,
      lastCalculated: new Date(),
      createdBy: new Types.ObjectId(userId),
    });

    const saved = await segment.save();
    this.logger.log(`Segment created: ${saved._id}`);
    return saved;
  }

  async findAllSegments(userId?: string) {
    const query: any = { isActive: true };
    
    if (userId) {
      query.createdBy = new Types.ObjectId(userId);
    }

    return this.segmentModel
      .find(query)
      .populate('createdBy', 'firstName lastName email')
      .sort({ createdAt: -1 });
  }

  async findSegment(id: string) {
    return this.segmentModel.findById(id);
  }

  async updateSegment(id: string, updateData: Partial<CreateSegmentDto>, userId: string) {
    // Recalculate count if filters changed
    if (updateData.filters) {
      const recipients = await this.getFilteredRecipients(updateData.filters);
      updateData['estimatedCount'] = recipients.count;
      updateData['lastCalculated'] = new Date();
    }

    return this.segmentModel.findByIdAndUpdate(
      id,
      {
        ...updateData,
        lastModifiedBy: new Types.ObjectId(userId),
      },
      { new: true },
    );
  }

  async deleteSegment(id: string) {
    return this.segmentModel.findByIdAndUpdate(
      id,
      { isActive: false },
      { new: true },
    );
  }

  async getSegmentRecipients(id: string) {
    const segment = await this.findSegment(id);
    if (!segment) {
      throw new Error('Segment not found');
    }

    const recipients = await this.getFilteredRecipients(segment.filters);

    // Update usage
    await this.segmentModel.findByIdAndUpdate(id, {
      $inc: { usageCount: 1 },
      lastUsed: new Date(),
    });

    return recipients;
  }

  async getRecipientCount(filters: RecipientFilterDto | any): Promise<number> {
    const recipients = await this.getFilteredRecipients({ ...filters, countOnly: true });
    return recipients.count;
  }
}