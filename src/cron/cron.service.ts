import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { StripeService } from 'src/payments/stripe/stripe.service';

@Injectable()
export class CronService {
  private readonly logger = new Logger(CronService.name);

  constructor(private readonly stripeService: StripeService) {}

  // ✅ Remove expired subscriptions every midnight
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleExpiredSubscriptions() {
    this.logger.log('⏳ Running expired subscription cleanup...');
    try {
      await this.stripeService.removeExpiredSubscriptions();
      this.logger.log('✅ Expired subscriptions cleanup completed.');
    } catch (error) {
      this.logger.error('❌ Error during expired subscription cleanup:', error);
    }
  }

  // ✅ Add more cron jobs as needed
}
