import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Event, EventSchema } from './schemas/event.schema';
import {
  EventRegistration,
  EventRegistrationSchema,
} from './schemas/eventRegistration.schema';
import { User, UserSchema } from '../users/user.schema';
import { EventsServiceOptimized } from './event.service.optimized';
import { EventsService } from './event.service';
import { EventsController } from './event.controller';
import { EventRegistrationsController } from './event-registration.controller';
import { EventRegistrationsService } from './event-registration.service';
import { EmailModule } from 'src/email/email.module';
import { CacheModule } from 'src/cache/cache.module';
import { LoggerModule } from 'src/logger/logger.module';
import { StripeModule } from 'src/payments/stripe/stripe.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Event.name, schema: EventSchema },
      { name: EventRegistration.name, schema: EventRegistrationSchema },
      { name: User.name, schema: UserSchema },
    ]),
    EmailModule,
    CacheModule,
    LoggerModule,
    forwardRef(() => StripeModule),
  ],
  controllers: [EventsController, EventRegistrationsController],
  providers: [
    {
      provide: 'EventsService',
      useClass: EventsServiceOptimized,
    },
    EventsServiceOptimized,
    EventsService,
    EventRegistrationsService,
  ],
  exports: [
    'EventsService',
    EventsServiceOptimized,
    EventsService,
    EventRegistrationsService,
  ],
})
export class EventModule {}
