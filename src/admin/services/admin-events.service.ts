import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Event, EventDocument } from '../../event/schemas/event.schema';
import {
  EventRegistration,
  EventRegistrationDocument,
} from '../../event/schemas/eventRegistration.schema';
import { CreateAdminEventDto } from '../dto/create-admin-event.dto';
import { UpdateAdminEventDto } from '../dto/update-admin-event.dto';
import { EventFiltersDto } from '../dto/event-filters.dto';
import * as ExcelJS from 'exceljs';
import * as PDFDocument from 'pdfkit';
import { CacheService } from '../../cache/cache.service';

@Injectable()
export class AdminEventsService {
  private readonly CACHE_PREFIX = 'event';
  
  constructor(
    @InjectModel(Event.name) private eventModel: Model<EventDocument>,
    @InjectModel(EventRegistration.name)
    private registrationModel: Model<EventRegistrationDocument>,
    private readonly cache: CacheService,
  ) {}

  async findAllWithFilters(filters: EventFiltersDto) {
    const {
      page = 1,
      limit = 20,
      search,
      type,
      status,
      startDate,
      endDate,
      sortBy = 'date',
      sortOrder = 'desc',
    } = filters;

    const query: any = {};

    // Search filter
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { location: { $regex: search, $options: 'i' } },
      ];
    }

    // Type filter
    if (type) {
      query.type = type;
    }

    // Status filter - check both status field and isActive
    if (status === 'draft') {
      query.$or = [
        { status: 'draft' },
        { isActive: false }
      ];
    } else if (status === 'active') {
      query.$and = [
        { $or: [{ status: 'active' }, { status: { $exists: false } }] },
        { isActive: { $ne: false } }
      ];
    } else if (status === 'completed') {
      query.status = 'completed';
    }

    // Date range filter
    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate) query.date.$lte = new Date(endDate);
    }

    const skip = (page - 1) * limit;
    const sort: any = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

    const [events, total] = await Promise.all([
      this.eventModel.find(query).sort(sort).skip(skip).limit(limit).lean(),
      this.eventModel.countDocuments(query),
    ]);

    // Get registration counts for each event
    const eventIds = events.map(e => e._id);
    const registrationCounts = await this.registrationModel.aggregate([
      { $match: { eventId: { $in: eventIds.map(id => id.toString()) } } },
      { $group: { _id: '$eventId', count: { $sum: 1 } } },
    ]);

    // Create a map of event ID to registration count
    const countMap = registrationCounts.reduce((acc, curr) => {
      acc[curr._id] = curr.count;
      return acc;
    }, {});

    // Add registration counts to events
    const eventsWithCounts = events.map(event => ({
      ...event,
      registrations: countMap[event._id.toString()] || 0,
      currentRegistrations: countMap[event._id.toString()] || 0,
    }));

    return {
      events: eventsWithCounts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string): Promise<EventDocument> {
    const event = await this.eventModel.findById(id);
    if (!event) {
      throw new NotFoundException('Event not found');
    }
    return event;
  }

  async findOneWithStats(id: string) {
    const event = await this.findOne(id);

    // Get registration statistics
    const [
      totalRegistrations,
      paidRegistrations,
      freeRegistrations,
      totalRevenue,
    ] = await Promise.all([
      this.registrationModel.countDocuments({ eventId: id }),
      this.registrationModel.countDocuments({
        eventId: id,
        paymentStatus: { $in: ['paid', 'completed'] },
      }),
      this.registrationModel.countDocuments({
        eventId: id,
        paymentStatus: 'free',
      }),
      this.registrationModel.aggregate([
        { $match: { eventId: id } }, // Use string ID instead of ObjectId
        {
          $project: {
            paidAmount: {
              $cond: {
                if: { $gt: ['$totalPaid', 0] },
                then: '$totalPaid',
                else: { $ifNull: ['$amountPaid', 0] }
              }
            }
          }
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$paidAmount' }
          }
        },
      ]),
    ]);

    const attendanceRate =
      event.capacity > 0 ? (totalRegistrations / event.capacity) * 100 : 0;

    return {
      ...event.toObject(),
      stats: {
        totalRegistrations,
        paidRegistrations,
        freeRegistrations,
        totalRevenue: totalRevenue[0]?.total || 0,
        attendanceRate: Math.round(attendanceRate * 100) / 100,
        spotsRemaining: event.capacity - totalRegistrations,
      },
    };
  }

  async create(createEventDto: CreateAdminEventDto): Promise<EventDocument> {
    // Validate dates
    if (createEventDto.startDate && createEventDto.endDate) {
      if (
        new Date(createEventDto.startDate) > new Date(createEventDto.endDate)
      ) {
        throw new BadRequestException('Start date must be before end date');
      }
    }

    // Check for overlapping events if location is specified
    if (createEventDto.location && createEventDto.date) {
      const overlapping = await this.eventModel.findOne({
        location: createEventDto.location,
        date: createEventDto.date,
        isActive: true,
      });

      if (overlapping) {
        throw new BadRequestException(
          'Another event is already scheduled at this location and time',
        );
      }
    }

    const event = new this.eventModel(createEventDto);
    return event.save();
  }

  async update(
    id: string,
    updateEventDto: UpdateAdminEventDto,
  ): Promise<EventDocument> {
    // Validate dates if provided
    if (updateEventDto.startDate && updateEventDto.endDate) {
      if (
        new Date(updateEventDto.startDate) > new Date(updateEventDto.endDate)
      ) {
        throw new BadRequestException('Start date must be before end date');
      }
    }

    const event = await this.eventModel.findByIdAndUpdate(
      id,
      { $set: updateEventDto },
      { new: true, runValidators: true },
    );

    if (!event) {
      throw new NotFoundException('Event not found');
    }

    // Invalidate all event caches to ensure fresh data is loaded
    await this.invalidateEventCache();

    return event;
  }

  async softDelete(id: string): Promise<boolean> {
    // Check if event has registrations
    const registrationCount = await this.registrationModel.countDocuments({
      eventId: id,
    });

    if (registrationCount > 0) {
      throw new BadRequestException(
        `Cannot delete event with ${registrationCount} registrations. Please deactivate it instead.`,
      );
    }

    const result = await this.eventModel.findByIdAndUpdate(
      id,
      { isActive: false },
      { new: true },
    );

    return !!result;
  }

  async getEventStatistics() {
    const [
      totalEvents,
      activeEvents,
      upcomingEvents,
      pastEvents,
      totalRegistrations,
      totalRevenue,
      eventsByType,
    ] = await Promise.all([
      this.eventModel.countDocuments(),
      this.eventModel.countDocuments({ isActive: true }),
      this.eventModel.countDocuments({
        date: { $gte: new Date() },
        isActive: true,
      }),
      this.eventModel.countDocuments({
        date: { $lt: new Date() },
      }),
      this.registrationModel.countDocuments(),
      this.registrationModel.aggregate([
        { $match: { paymentStatus: { $in: ['paid', 'completed'] } } },
        { $group: { _id: null, total: { $sum: '$amountPaid' } } },
      ]),
      this.eventModel.aggregate([
        { $group: { _id: '$type', count: { $sum: 1 } } },
      ]),
    ]);

    return {
      totalEvents,
      activeEvents,
      upcomingEvents,
      pastEvents,
      totalRegistrations,
      totalRevenue: totalRevenue[0]?.total || 0,
      eventsByType: eventsByType.reduce((acc, curr) => {
        acc[curr._id] = curr.count;
        return acc;
      }, {}),
    };
  }

  async getEventRegistrations(
    eventId: string,
    options: {
      page: number;
      limit: number;
      search?: string;
      paymentStatus?: string;
    },
  ) {
    const { page, limit, search, paymentStatus } = options;
    const query: any = { eventId };

    if (search) {
      query.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }

    if (paymentStatus) {
      query.paymentStatus = paymentStatus;
    }

    const skip = (page - 1) * limit;

    const [registrations, total] = await Promise.all([
      this.registrationModel
        .find(query)
        // Populate userId to get the actual user's _id for module permissions lookup
        .populate('userId', '_id firstName lastName email phoneNumber')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      this.registrationModel.countDocuments(query),
    ]);

    console.log('🔵 SERVICE - Raw registration from DB:', registrations[0]);

    // Map registrations to ensure the frontend gets the expected format
    const mappedRegistrations = registrations.map((reg: any) => {
      console.log('🔵 SERVICE - Mapping registration:', {
        _id: reg._id,
        totalPaid: reg.totalPaid,
        totalAmount: reg.totalAmount,
        remainingBalance: reg.remainingBalance,
        paymentMode: reg.paymentMode,
        amountPaid: reg.amountPaid,
      });

      return {
      _id: reg._id,
      // Don't use userId - use the registration's actual data
      userId: reg.userId, // Keep the userId reference but don't populate it
      eventId: reg.eventId,
      ticketType: reg.isVip ? 'vip' : 'general',
      paymentStatus:
        reg.paymentStatus === 'paid' ? 'completed' : reg.paymentStatus,
      paymentMethod: reg.paymentMethod,
      transactionId: reg.stripeSessionId,
      amount: reg.totalPaid || reg.amountPaid || 0,
      registeredAt: reg.createdAt,
      checkedIn: reg.checkedIn || false,
      checkedInAt: reg.checkedInAt,
      createdAt: reg.createdAt,
      updatedAt: reg.updatedAt,
      // Include original registration data for flexibility
      firstName: reg.firstName,
      lastName: reg.lastName,
      email: reg.email,
      phone: reg.phoneNumber,
      phoneNumber: reg.phoneNumber,
      isVip: reg.isVip,
      amountPaid: reg.amountPaid,
      // Partial payment fields
      totalAmount: reg.totalAmount,
      totalPaid: reg.totalPaid,
      remainingBalance: reg.remainingBalance,
      isFullyPaid: reg.isFullyPaid,
      paymentMode: reg.paymentMode,
      // Include additionalInfo for attendees information
      additionalInfo: reg.additionalInfo,
      };
    });

    console.log('🔵 SERVICE - Mapped result sample:', mappedRegistrations[0]);

    return {
      data: mappedRegistrations,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getRegistrationsForExport(eventId: string, filters?: any) {
    const query: any = { eventId };

    if (filters?.paymentStatus) {
      query.paymentStatus = filters.paymentStatus;
    }

    return this.registrationModel
      .find(query)
      .populate('userId', 'firstName lastName email phoneNumber')
      .sort({ createdAt: -1 })
      .lean();
  }

  async generateCSV(registrations: any[], event: any): Promise<Buffer> {
    const headers = [
      'Registration ID',
      'First Name',
      'Last Name',
      'Email',
      'Phone',
      'Registration Date',
      'Payment Status',
      'Amount Paid',
      'Registration Type',
      'Additional Adults',
      'Children',
      'Total Attendees',
      'Promo Code',
    ];

    const rows = registrations.map((reg) => {
      const additionalAdults = reg.additionalInfo?.additionalAttendees?.adults || 0;
      const children = reg.additionalInfo?.additionalAttendees?.children || 0;
      const totalAttendees = 1 + additionalAdults + children;
      
      return [
        reg._id.toString(),
        reg.firstName,
        reg.lastName,
        reg.email,
        reg.phoneNumber || '',
        new Date(reg.createdAt).toLocaleString(),
        reg.paymentStatus,
        reg.totalPaid || reg.amountPaid || 0,
        reg.registrationType,
        additionalAdults,
        children,
        totalAttendees,
        reg.promoCode || '',
      ];
    });

    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(',')),
    ].join('\n');

    return Buffer.from(csvContent, 'utf-8');
  }

  async generateExcel(registrations: any[], event: any): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Registrations');

    // Add event info
    worksheet.addRow(['Event Name:', event.name]);
    worksheet.addRow([
      'Event Date:',
      new Date(event.date).toLocaleDateString(),
    ]);
    worksheet.addRow(['Total Registrations:', registrations.length]);
    worksheet.addRow([]); // Empty row

    // Add headers
    const headers = [
      'Registration ID',
      'First Name',
      'Last Name',
      'Email',
      'Phone',
      'Registration Date',
      'Payment Status',
      'Amount Paid',
      'Registration Type',
      'Additional Adults',
      'Children',
      'Total Attendees',
      'Promo Code',
    ];

    const headerRow = worksheet.addRow(headers);
    headerRow.font = { bold: true };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' },
    };

    // Add data
    registrations.forEach((reg) => {
      const additionalAdults = reg.additionalInfo?.additionalAttendees?.adults || 0;
      const children = reg.additionalInfo?.additionalAttendees?.children || 0;
      const totalAttendees = 1 + additionalAdults + children;
      
      worksheet.addRow([
        reg._id.toString(),
        reg.firstName,
        reg.lastName,
        reg.email,
        reg.phoneNumber || '',
        new Date(reg.createdAt).toLocaleString(),
        reg.paymentStatus,
        reg.totalPaid || reg.amountPaid || 0,
        reg.registrationType,
        additionalAdults,
        children,
        totalAttendees,
        reg.promoCode || '',
      ]);
    });

    // Auto-fit columns
    worksheet.columns.forEach((column) => {
      column.width = 15;
    });

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  async generatePDF(registrations: any[], event: any): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument();
      const chunks: Buffer[] = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Add header
      doc.fontSize(20).text('Event Registration Report', { align: 'center' });
      doc.moveDown();

      // Add event info
      doc.fontSize(14).text(`Event: ${event.name}`);
      doc
        .fontSize(12)
        .text(`Date: ${new Date(event.date).toLocaleDateString()}`);
      doc.text(`Location: ${event.location || 'TBD'}`);
      doc.text(`Total Registrations: ${registrations.length}`);
      doc.moveDown();

      // Add registration summary
      const paidCount = registrations.filter(
        (r) => r.paymentStatus === 'paid' || r.paymentStatus === 'completed',
      ).length;
      const freeCount = registrations.filter(
        (r) => r.paymentStatus === 'free',
      ).length;
      const totalRevenue = registrations.reduce(
        (sum, r) => sum + (r.totalPaid || r.amountPaid || 0),
        0,
      );
      
      // Calculate total attendees
      let totalAttendeesCount = 0;
      registrations.forEach((reg) => {
        totalAttendeesCount += 1; // The registrant
        if (reg.additionalInfo?.additionalAttendees) {
          totalAttendeesCount += reg.additionalInfo.additionalAttendees.adults || 0;
          totalAttendeesCount += reg.additionalInfo.additionalAttendees.children || 0;
        }
      });

      doc.text(`Paid Registrations: ${paidCount}`);
      doc.text(`Free Registrations: ${freeCount}`);
      doc.text(`Total Attendees: ${totalAttendeesCount} (Including companions)`);
      doc.text(`Total Revenue: $${totalRevenue.toFixed(2)}`);
      doc.moveDown();

      // Add registration list
      doc.fontSize(14).text('Registration List:', { underline: true });
      doc.moveDown();

      registrations.forEach((reg, index) => {
        if (index > 0 && index % 10 === 0) {
          doc.addPage();
        }

        // Calculate attendees for this registration
        const additionalAdults = reg.additionalInfo?.additionalAttendees?.adults || 0;
        const children = reg.additionalInfo?.additionalAttendees?.children || 0;
        const totalAttendees = 1 + additionalAdults + children;
        
        doc.fontSize(10);
        doc.text(`${index + 1}. ${reg.firstName} ${reg.lastName}`);
        doc.text(`   Email: ${reg.email}`);
        doc.text(`   Phone: ${reg.phoneNumber || 'N/A'}`);
        doc.text(`   Asistentes: ${totalAttendees} (${1 + additionalAdults} adulto${1 + additionalAdults > 1 ? 's' : ''}${children > 0 ? `, ${children} niño${children > 1 ? 's' : ''}` : ''})`);
        doc.text(
          `   Status: ${reg.paymentStatus} | Amount: $${reg.totalPaid || reg.amountPaid || 0}`,
        );
        doc.moveDown(0.5);
      });

      doc.end();
    });
  }

  async toggleStatus(id: string): Promise<any> {
    const event = await this.eventModel.findById(id);

    if (!event) {
      throw new NotFoundException('Event not found');
    }

    event.isActive = !event.isActive;
    await event.save();

    return event;
  }

  async getEventStatisticsById(id: string) {
    // Verify event exists
    const event = await this.eventModel.findById(id);
    if (!event) {
      throw new NotFoundException('Event not found');
    }

    // Get all registrations for this event
    const registrations = await this.registrationModel
      .find({ eventId: id })
      .populate('userId', 'firstName lastName email')
      .lean();

    // Calculate statistics
    const totalRegistrations = registrations.length;
    const vipRegistrations = registrations.filter(
      (r: any) => r.isVip === true,
    ).length;
    const generalRegistrations = registrations.filter(
      (r: any) => r.isVip === false,
    ).length;

    // Calculate revenue (support both partial and full payments)
    const totalRevenue = registrations.reduce(
      (sum, r: any) => sum + (r.totalPaid || r.amountPaid || 0),
      0,
    );
    const vipRevenue = registrations
      .filter((r: any) => r.isVip === true)
      .reduce((sum, r: any) => sum + (r.totalPaid || r.amountPaid || 0), 0);
    const generalRevenue = registrations
      .filter((r: any) => r.isVip === false)
      .reduce((sum, r: any) => sum + (r.totalPaid || r.amountPaid || 0), 0);

    // Calculate check-in rate (using a field that might exist)
    const checkedInCount = registrations.filter((r: any) => r.checkedIn).length;
    const checkInRate =
      totalRegistrations > 0 ? (checkedInCount / totalRegistrations) * 100 : 0;

    // Payment status breakdown
    const paymentStatusBreakdown = {
      pending: registrations.filter((r: any) => r.paymentStatus === 'pending')
        .length,
      completed: registrations.filter((r: any) => 
        r.paymentStatus === 'paid' || r.paymentStatus === 'completed'
      ).length,
      failed: 0, // Not in the schema
      refunded: 0, // Not in the schema
    };
    
    // Count paid registrations (both 'paid' and 'completed' statuses)
    const paidRegistrations = registrations.filter((r: any) => 
      r.paymentStatus === 'paid' || r.paymentStatus === 'completed'
    ).length;

    // Calculate daily registrations (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const dailyRegistrations = [];
    const registrationsByDate = new Map();

    // Group registrations by date
    registrations.forEach((reg: any) => {
      if (reg.createdAt) {
        const date = new Date(reg.createdAt).toISOString().split('T')[0];
        if (!registrationsByDate.has(date)) {
          registrationsByDate.set(date, { count: 0, revenue: 0 });
        }
        const dayData = registrationsByDate.get(date);
        dayData.count++;
        dayData.revenue += reg.totalPaid || reg.amountPaid || 0;
      }
    });

    // Convert to array format
    registrationsByDate.forEach((data, date) => {
      dailyRegistrations.push({
        date,
        count: data.count,
        revenue: data.revenue,
      });
    });

    // Sort by date
    dailyRegistrations.sort((a, b) => a.date.localeCompare(b.date));

    // Calculate capacity utilization
    const capacityUtilization =
      event.capacity > 0 ? (totalRegistrations / event.capacity) * 100 : 0;

    return {
      totalRegistrations,
      vipRegistrations,
      generalRegistrations,
      paidRegistrations,
      totalRevenue,
      vipRevenue,
      generalRevenue,
      paymentStatusBreakdown,
      dailyRegistrations: dailyRegistrations.slice(-30), // Last 30 days
      checkInRate: Math.round(checkInRate * 100) / 100,
      capacityUtilization: Math.round(capacityUtilization * 100) / 100,
    };
  }

  async setFeaturedEventForType(eventId: string, type: string): Promise<EventDocument> {
    // First, unset featuredInCRM for all events of the same type
    await this.eventModel.updateMany(
      { 
        type, 
        featuredInCRM: true 
      },
      { 
        $set: { featuredInCRM: false } 
      }
    );

    // Then set the specified event as featured
    const updatedEvent = await this.eventModel.findByIdAndUpdate(
      eventId,
      { 
        $set: { featuredInCRM: true } 
      },
      { 
        new: true,
        runValidators: true 
      }
    );

    if (!updatedEvent) {
      throw new NotFoundException('Event not found');
    }

    // Invalidate cache for community events
    await this.invalidateEventCache();

    return updatedEvent;
  }

  async toggleFeaturedStatus(eventId: string): Promise<EventDocument> {
    const event = await this.eventModel.findById(eventId);
    
    if (!event) {
      throw new NotFoundException('Event not found');
    }

    const newFeaturedStatus = !event.featuredInCRM;

    // If setting to true, unset other events of the same type
    if (newFeaturedStatus) {
      await this.eventModel.updateMany(
        { 
          type: event.type, 
          featuredInCRM: true,
          _id: { $ne: eventId }
        },
        { 
          $set: { featuredInCRM: false } 
        }
      );
    }

    // Update the event
    event.featuredInCRM = newFeaturedStatus;
    await event.save();

    // Invalidate cache for community events
    await this.invalidateEventCache();

    return event;
  }

  private async invalidateEventCache(): Promise<void> {
    try {
      // Invalidate all event-related caches
      await this.cache.invalidatePattern(`${this.CACHE_PREFIX}:*`);
    } catch (error) {
      // Log error but don't fail the operation
      console.error('Failed to invalidate cache:', error);
    }
  }
}
