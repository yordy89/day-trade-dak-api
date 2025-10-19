import {
  Controller,
  Post,
  Get,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt-auth-guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';
import { EventPartialPaymentService } from './event-partial-payment.service';
import { InitiatePartialPaymentDto } from './dto/initiate-partial-payment.dto';
import {
  MakePaymentDto,
  SearchRegistrationDto,
  UpdatePaymentSettingsDto,
} from './dto/make-payment.dto';
import { EventsService } from './event.service';
import { Role } from '../constants';

@ApiTags('Event Partial Payments')
@Controller('event-registrations')
export class EventPartialPaymentController {
  constructor(
    private readonly partialPaymentService: EventPartialPaymentService,
    private readonly eventsService: EventsService,
  ) {}

  @Post('initiate-partial')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Initiate a partial payment registration' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Partial payment registration initiated successfully',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid data or payment not allowed',
  })
  async initiatePartialPayment(
    @Body() dto: InitiatePartialPaymentDto,
    @Request() req: any,
  ) {
    // Add user ID from JWT if available
    if (req.user) {
      dto.userId = req.user.userId;
    }

    return await this.partialPaymentService.initiatePartialPayment(dto);
  }

  @Get('check-balance/:registrationId')
  @ApiOperation({ summary: 'Check remaining balance for a registration' })
  @ApiParam({
    name: 'registrationId',
    description: 'Registration ID',
    required: true,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Balance and payment history retrieved',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Registration not found',
  })
  async checkBalance(@Param('registrationId') registrationId: string) {
    return await this.partialPaymentService.getRegistrationBalance(
      registrationId,
    );
  }

  @Post('make-payment/:registrationId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Make an additional payment on a registration' })
  @ApiParam({
    name: 'registrationId',
    description: 'Registration ID',
    required: true,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Payment initiated successfully',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid payment amount or registration already paid',
  })
  async makePayment(
    @Param('registrationId') registrationId: string,
    @Body() dto: MakePaymentDto,
  ) {
    return await this.partialPaymentService.makePayment(registrationId, dto);
  }

  @Post('search')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Search for registrations' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Registrations found',
  })
  async searchRegistrations(@Body() dto: SearchRegistrationDto) {
    return await this.partialPaymentService.searchRegistrations(dto);
  }

  @Get('payment-history/:registrationId')
  @ApiOperation({ summary: 'Get payment history for a registration' })
  @ApiParam({
    name: 'registrationId',
    description: 'Registration ID',
    required: true,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Payment history retrieved',
  })
  async getPaymentHistory(@Param('registrationId') registrationId: string) {
    return await this.partialPaymentService.getRegistrationBalance(
      registrationId,
    );
  }

  // Admin endpoints

  @Get('partial-payments/:eventId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all partial payment registrations for an event' })
  @ApiParam({
    name: 'eventId',
    description: 'Event ID',
    required: true,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Partial payment registrations retrieved',
  })
  async getEventPartialPayments(@Param('eventId') eventId: string) {
    return await this.partialPaymentService.getEventPartialPayments(eventId);
  }

  @Put('events/:eventId/payment-settings')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update payment settings for an event' })
  @ApiParam({
    name: 'eventId',
    description: 'Event ID',
    required: true,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Payment settings updated successfully',
  })
  async updateEventPaymentSettings(
    @Param('eventId') eventId: string,
    @Body() dto: UpdatePaymentSettingsDto,
  ) {
    const event = await this.eventsService.findOne(eventId);

    if (!event) {
      throw new Error('Event not found');
    }

    // Update payment settings
    if (dto.paymentMode !== undefined) {
      event.paymentMode = dto.paymentMode;
    }

    if (dto.minimumDepositAmount !== undefined) {
      event.minimumDepositAmount = dto.minimumDepositAmount;
    }

    if (dto.depositPercentage !== undefined) {
      event.depositPercentage = dto.depositPercentage;
    }

    if (dto.minimumInstallmentAmount !== undefined) {
      event.minimumInstallmentAmount = dto.minimumInstallmentAmount;
    }

    if (dto.allowedFinancingPlans !== undefined) {
      event.allowedFinancingPlans = dto.allowedFinancingPlans;
    }

    if (dto.allowCustomPaymentPlan !== undefined) {
      event.allowCustomPaymentPlan = dto.allowCustomPaymentPlan;
    }

    if (dto.paymentSettings !== undefined) {
      event.paymentSettings = {
        ...event.paymentSettings,
        ...dto.paymentSettings,
      };
    }

    await event.save();

    return {
      message: 'Payment settings updated successfully',
      event: {
        id: event._id,
        name: event.name,
        paymentMode: event.paymentMode,
        minimumDepositAmount: event.minimumDepositAmount,
        depositPercentage: event.depositPercentage,
        minimumInstallmentAmount: event.minimumInstallmentAmount,
        allowedFinancingPlans: event.allowedFinancingPlans,
        allowCustomPaymentPlan: event.allowCustomPaymentPlan,
        paymentSettings: event.paymentSettings,
      },
    };
  }

  @Post('events/:eventId/toggle-payment-mode')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Toggle payment mode between full and partial' })
  @ApiParam({
    name: 'eventId',
    description: 'Event ID',
    required: true,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Payment mode toggled successfully',
  })
  async togglePaymentMode(@Param('eventId') eventId: string) {
    const event = await this.eventsService.findOne(eventId);

    if (!event) {
      throw new Error('Event not found');
    }

    // Toggle payment mode
    event.paymentMode =
      event.paymentMode === 'partial_allowed' ? 'full_only' : 'partial_allowed';

    await event.save();

    return {
      message: `Payment mode changed to ${event.paymentMode}`,
      paymentMode: event.paymentMode,
    };
  }

  // Webhook endpoint for Stripe payment success

  @Post('webhook/payment-success')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Webhook for successful payment processing' })
  async handlePaymentSuccess(
    @Body()
    body: {
      paymentId: string;
      stripePaymentIntentId: string;
      receiptUrl?: string;
    },
  ) {
    return await this.partialPaymentService.processSuccessfulPayment(
      body.paymentId,
      body.stripePaymentIntentId,
      body.receiptUrl,
    );
  }
}