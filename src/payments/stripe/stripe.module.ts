import { Module, forwardRef } from '@nestjs/common';
import { StripeController } from './stripe.controller';
import { StripeService } from './stripe.service';
import { PricingService } from './pricing.service';
import { PaymentAnalyticsService } from './payment-analytics.service';
import { PaymentReportsController } from './payment-reports.controller';
import { PublicPricingController } from './public-pricing.controller';
import { SubscriptionUpdateFixer } from './subscription-update-fix';
import { MongooseModule } from '@nestjs/mongoose';
import { TransactionSchema } from './transaction.schema';
import { SubscriptionHistorySchema } from './subscription-history.schema';
import { WebhookEventSchema } from './webhook-event.schema';
import { EventSchema } from 'src/event/schemas/event.schema';
import { SubscriptionPlanSchema } from 'src/subscriptions/subscription-plan.schema';
import { UserSchema } from 'src/users/user.schema';
import { UsersModule } from 'src/users/users.module';
import { AuthModule } from 'src/auth/auth.module';
import { EventModule } from 'src/event/event.module';
import { EmailModule } from 'src/email/email.module';
import { AffiliateModule } from 'src/affiliate/affiliate.module';
import { ModulePermissionsModule } from 'src/module-permissions/module-permissions.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'Transaction', schema: TransactionSchema },
      { name: 'SubscriptionHistory', schema: SubscriptionHistorySchema },
      { name: 'WebhookEvent', schema: WebhookEventSchema },
      { name: 'Event', schema: EventSchema },
      { name: 'SubscriptionPlan', schema: SubscriptionPlanSchema },
      { name: 'User', schema: UserSchema },
    ]),
    UsersModule,
    AuthModule,
    forwardRef(() => EventModule),
    forwardRef(() => AffiliateModule),
    EmailModule,
    ModulePermissionsModule,
  ],
  controllers: [
    StripeController,
    PaymentReportsController,
    PublicPricingController,
  ],
  providers: [StripeService, PricingService, PaymentAnalyticsService, SubscriptionUpdateFixer],
  exports: [StripeService, PricingService, PaymentAnalyticsService, SubscriptionUpdateFixer],
})
export class StripeModule {}
