import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Event, EventSchema } from './schemas/event.schema';
import {
  EventRegistration,
  EventRegistrationSchema,
} from './schemas/eventRegistration.schema';
import {
  EventPaymentTracker,
  EventPaymentTrackerSchema,
} from './schemas/eventPaymentTracker.schema';
import {
  InstallmentPlan,
  InstallmentPlanSchema,
} from '../payments/local-financing/installment-plan.schema';
import { User, UserSchema } from '../users/user.schema';
import { EventsServiceOptimized } from './event.service.optimized';
import { EventsService } from './event.service';
import { EventsController } from './event.controller';
import { EventRegistrationsController } from './event-registration.controller';
import { EventRegistrationsService } from './event-registration.service';
import { EventPartialPaymentService } from './event-partial-payment.service';
import { EventPartialPaymentController } from './event-partial-payment.controller';
import { FixPartialPaymentsController } from './fix-partial-payments.controller';
import { EmailModule } from 'src/email/email.module';
import { CacheModule } from 'src/cache/cache.module';
import { LoggerModule } from 'src/logger/logger.module';
import { StripeModule } from 'src/payments/stripe/stripe.module';
import { LocalFinancingModule } from 'src/payments/local-financing/local-financing.module';
import { GuardsModule } from 'src/guards/guards.module';
import { UsersModule } from 'src/users/users.module';
import { AffiliateModule } from 'src/affiliate/affiliate.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Event.name, schema: EventSchema },
      { name: EventRegistration.name, schema: EventRegistrationSchema },
      { name: EventPaymentTracker.name, schema: EventPaymentTrackerSchema },
      { name: InstallmentPlan.name, schema: InstallmentPlanSchema },
      { name: User.name, schema: UserSchema },
    ]),
    EmailModule,
    CacheModule,
    LoggerModule,
    GuardsModule,
    forwardRef(() => UsersModule),
    forwardRef(() => StripeModule),
    forwardRef(() => LocalFinancingModule),
    forwardRef(() => AffiliateModule),
  ],
  controllers: [
    EventsController,
    EventRegistrationsController,
    EventPartialPaymentController,
    FixPartialPaymentsController,
  ],
  providers: [
    {
      provide: 'EventsService',
      useClass: EventsServiceOptimized,
    },
    EventsServiceOptimized,
    EventsService,
    EventRegistrationsService,
    EventPartialPaymentService,
  ],
  exports: [
    'EventsService',
    EventsServiceOptimized,
    EventsService,
    EventRegistrationsService,
    EventPartialPaymentService,
  ],
})
export class EventModule {}
