import { Controller, Post, Get, Delete, UseGuards, Param, Query } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  EventRegistration,
  EventRegistrationDocument,
} from './schemas/eventRegistration.schema';
import {
  EventPaymentTracker,
  EventPaymentTrackerDocument,
  PaymentStatus,
} from './schemas/eventPaymentTracker.schema';
import { JwtAuthGuard } from '../guards/jwt-auth-guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';
import { Role } from '../constants';

@Controller('admin/fix-payments')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.SUPER_ADMIN)
export class FixPartialPaymentsController {
  constructor(
    @InjectModel(EventRegistration.name)
    private eventRegistrationModel: Model<EventRegistrationDocument>,
    @InjectModel(EventPaymentTracker.name)
    private paymentTrackerModel: Model<EventPaymentTrackerDocument>,
  ) {}

  @Post('recalculate-all')
  async recalculateAllPartialPayments() {
    const registrations = await this.eventRegistrationModel.find({
      paymentMode: 'partial',
    });

    const results = [];

    for (const registration of registrations) {
      const result = await this.recalculateRegistration(registration._id.toString());
      results.push(result);
    }

    return {
      message: 'Recalculation complete',
      processed: results.length,
      results,
    };
  }

  @Post('recalculate/:registrationId')
  async recalculateRegistration(@Param('registrationId') registrationId: string) {
    const registration = await this.eventRegistrationModel.findById(registrationId);

    if (!registration) {
      return { error: 'Registration not found' };
    }

    // Get all completed payments
    const completedPayments = await this.paymentTrackerModel.find({
      registrationId: registration._id,
      status: PaymentStatus.COMPLETED,
    });

    // Calculate totals
    const calculatedTotal = completedPayments.reduce(
      (sum, payment) => sum + (payment.amount || 0),
      0,
    );
    const totalAmount = registration.totalAmount || 0;
    const remainingBalance = Math.max(0, totalAmount - calculatedTotal);

    const oldValues = {
      totalPaid: registration.totalPaid,
      remainingBalance: registration.remainingBalance,
      isFullyPaid: registration.isFullyPaid,
    };

    // Update registration
    registration.totalPaid = calculatedTotal;
    registration.remainingBalance = remainingBalance;
    registration.isFullyPaid = remainingBalance <= 0;
    registration.paymentStatus = remainingBalance <= 0 ? 'paid' : 'pending';

    await registration.save();

    return {
      registrationId: registration._id,
      email: registration.email,
      oldValues,
      newValues: {
        totalPaid: registration.totalPaid,
        remainingBalance: registration.remainingBalance,
        isFullyPaid: registration.isFullyPaid,
      },
      paymentsProcessed: completedPayments.length,
      calculatedTotal,
    };
  }

  @Get('check/:registrationId')
  async checkRegistration(@Param('registrationId') registrationId: string) {
    const registration = await this.eventRegistrationModel.findById(registrationId);
    const payments = await this.paymentTrackerModel.find({
      registrationId,
    });

    return {
      registration: {
        _id: registration._id,
        email: registration.email,
        totalAmount: registration.totalAmount,
        totalPaid: registration.totalPaid,
        remainingBalance: registration.remainingBalance,
        isFullyPaid: registration.isFullyPaid,
        paymentStatus: registration.paymentStatus,
      },
      payments: payments.map(p => ({
        paymentId: p.paymentId,
        amount: p.amount,
        status: p.status,
        type: p.paymentType,
        processedAt: p.processedAt,
      })),
    };
  }

  @Delete('clear-event/:eventId')
  async clearEventRegistrations(@Param('eventId') eventId: string) {
    // Delete ALL registrations for this event
    const registrations = await this.eventRegistrationModel.find({ eventId });

    const deletedCount = registrations.length;

    for (const reg of registrations) {
      // Delete payment trackers
      await this.paymentTrackerModel.deleteMany({
        registrationId: reg._id,
      });

      // Delete registration
      await this.eventRegistrationModel.findByIdAndDelete(reg._id);
    }

    return {
      message: `Deleted ${deletedCount} registration(s) and all their payment trackers`,
      deletedCount,
      eventId,
    };
  }

  @Delete('registration/:registrationId')
  async deleteRegistration(@Param('registrationId') registrationId: string) {
    // Delete a specific registration and its payment trackers
    await this.paymentTrackerModel.deleteMany({
      registrationId,
    });

    await this.eventRegistrationModel.findByIdAndDelete(registrationId);

    return {
      message: 'Registration and payment trackers deleted successfully',
      registrationId,
    };
  }
}
