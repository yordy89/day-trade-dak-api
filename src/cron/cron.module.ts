import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { StripeModule } from 'src/payments/stripe/stripe.module';
import { CronService } from './cron.service';
import { UsersModule } from 'src/users/users.module';
import { EmailModule } from 'src/email/email.module';
import { TransactionSchema } from 'src/payments/stripe/transaction.schema';
import { SubscriptionHistorySchema } from 'src/payments/stripe/subscription-history.schema';
import { ModulePermissionsModule } from 'src/module-permissions/module-permissions.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'Transaction', schema: TransactionSchema },
      { name: 'SubscriptionHistory', schema: SubscriptionHistorySchema },
    ]),
    StripeModule,
    UsersModule,
    EmailModule,
    ModulePermissionsModule,
  ],
  providers: [CronService],
})
export class CronModule {}
