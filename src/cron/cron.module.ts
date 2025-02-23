import { Module } from '@nestjs/common';
import { CronService } from './cron.service';
import { StripeModule } from 'src/payments/stripe/stripe.module';

@Module({
  imports: [StripeModule],
  providers: [CronService],
})
export class CronModule {}
