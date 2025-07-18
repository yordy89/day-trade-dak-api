import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Event, EventDocument } from '../../event/schemas/event.schema';
import { EventRegistration, EventRegistrationDocument } from '../../event/schemas/eventRegistration.schema';
import { CreateAdminEventDto } from '../dto/create-admin-event.dto';
import { UpdateAdminEventDto } from '../dto/update-admin-event.dto';
import { EventFiltersDto } from '../dto/event-filters.dto';
import * as ExcelJS from 'exceljs';
import * as PDFDocument from 'pdfkit';

@Injectable()
export class AdminEventsService {
  constructor(
    @InjectModel(Event.name) private eventModel: Model<EventDocument>,
    @InjectModel(EventRegistration.name) private registrationModel: Model<EventRegistrationDocument>,
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

    // Status filter
    if (status !== undefined) {
      query.isActive = status === 'active';
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
      this.eventModel
        .find(query)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean(),
      this.eventModel.countDocuments(query),
    ]);

    return {
      events,
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
        paymentStatus: 'paid' 
      }),
      this.registrationModel.countDocuments({ 
        eventId: id, 
        paymentStatus: 'free' 
      }),
      this.registrationModel.aggregate([
        { $match: { eventId: event._id, paymentStatus: 'paid' } },
        { $group: { _id: null, total: { $sum: '$amountPaid' } } },
      ]),
    ]);

    const attendanceRate = event.capacity > 0 
      ? (totalRegistrations / event.capacity) * 100 
      : 0;

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
      if (new Date(createEventDto.startDate) > new Date(createEventDto.endDate)) {
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

  async update(id: string, updateEventDto: UpdateAdminEventDto): Promise<EventDocument> {
    // Validate dates if provided
    if (updateEventDto.startDate && updateEventDto.endDate) {
      if (new Date(updateEventDto.startDate) > new Date(updateEventDto.endDate)) {
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

    return event;
  }

  async softDelete(id: string): Promise<boolean> {
    // Check if event has registrations
    const registrationCount = await this.registrationModel.countDocuments({ eventId: id });
    
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
        { $match: { paymentStatus: 'paid' } },
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
        .populate('userId', 'firstName lastName email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      this.registrationModel.countDocuments(query),
    ]);

    return {
      registrations,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
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
      'Promo Code',
    ];

    const rows = registrations.map(reg => [
      reg._id.toString(),
      reg.firstName,
      reg.lastName,
      reg.email,
      reg.phoneNumber || '',
      new Date(reg.createdAt).toLocaleString(),
      reg.paymentStatus,
      reg.amountPaid || 0,
      reg.registrationType,
      reg.promoCode || '',
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
    ].join('\n');

    return Buffer.from(csvContent, 'utf-8');
  }

  async generateExcel(registrations: any[], event: any): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Registrations');

    // Add event info
    worksheet.addRow(['Event Name:', event.name]);
    worksheet.addRow(['Event Date:', new Date(event.date).toLocaleDateString()]);
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
    registrations.forEach(reg => {
      worksheet.addRow([
        reg._id.toString(),
        reg.firstName,
        reg.lastName,
        reg.email,
        reg.phoneNumber || '',
        new Date(reg.createdAt).toLocaleString(),
        reg.paymentStatus,
        reg.amountPaid || 0,
        reg.registrationType,
        reg.promoCode || '',
      ]);
    });

    // Auto-fit columns
    worksheet.columns.forEach(column => {
      column.width = 15;
    });

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  async generatePDF(registrations: any[], event: any): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument();
      const chunks: Buffer[] = [];

      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Add header
      doc.fontSize(20).text('Event Registration Report', { align: 'center' });
      doc.moveDown();

      // Add event info
      doc.fontSize(14).text(`Event: ${event.name}`);
      doc.fontSize(12).text(`Date: ${new Date(event.date).toLocaleDateString()}`);
      doc.text(`Location: ${event.location || 'TBD'}`);
      doc.text(`Total Registrations: ${registrations.length}`);
      doc.moveDown();

      // Add registration summary
      const paidCount = registrations.filter(r => r.paymentStatus === 'paid').length;
      const freeCount = registrations.filter(r => r.paymentStatus === 'free').length;
      const totalRevenue = registrations.reduce((sum, r) => sum + (r.amountPaid || 0), 0);

      doc.text(`Paid Registrations: ${paidCount}`);
      doc.text(`Free Registrations: ${freeCount}`);
      doc.text(`Total Revenue: $${totalRevenue.toFixed(2)}`);
      doc.moveDown();

      // Add registration list
      doc.fontSize(14).text('Registration List:', { underline: true });
      doc.moveDown();

      registrations.forEach((reg, index) => {
        if (index > 0 && index % 10 === 0) {
          doc.addPage();
        }

        doc.fontSize(10);
        doc.text(`${index + 1}. ${reg.firstName} ${reg.lastName}`);
        doc.text(`   Email: ${reg.email}`);
        doc.text(`   Phone: ${reg.phoneNumber || 'N/A'}`);
        doc.text(`   Status: ${reg.paymentStatus} | Amount: $${reg.amountPaid || 0}`);
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
}