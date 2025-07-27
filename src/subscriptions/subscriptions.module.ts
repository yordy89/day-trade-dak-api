import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  SubscriptionPlan,
  SubscriptionPlanSchema,
} from './subscription-plan.schema';
import { User, UserSchema } from '../users/user.schema';
import { SubscriptionsService } from './subscriptions.service';
import { SubscriptionsController } from './subscriptions.controller';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';
import { StripeModule } from '../payments/stripe/stripe.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: SubscriptionPlan.name, schema: SubscriptionPlanSchema },
      { name: User.name, schema: UserSchema },
    ]),
    AuthModule,
    UsersModule,
    forwardRef(() => StripeModule), // Use forwardRef to avoid circular dependency
  ],
  controllers: [SubscriptionsController],
  providers: [SubscriptionsService],
  exports: [SubscriptionsService, MongooseModule], // Export MongooseModule so other modules can use the schemas
})
export class SubscriptionsModule {}
