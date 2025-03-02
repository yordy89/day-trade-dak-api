import { Module } from '@nestjs/common';
import { StripeModule } from 'src/payments/stripe/stripe.module';
import { CronService } from './cron.service';
import { UsersModule } from 'src/users/users.module';

@Module({
  imports: [StripeModule, UsersModule],
  providers: [CronService],
})
export class CronModule {}
