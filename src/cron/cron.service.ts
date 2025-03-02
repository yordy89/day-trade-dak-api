import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { UserService } from 'src/users/users.service';

@Injectable()
export class CronService {
  private readonly logger = new Logger(CronService.name);

  constructor(private readonly userService: UserService) {}

  // ✅ Remove expired subscriptions every midnight
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async removeExpiredSubscriptions() {
    const now = new Date();
    this.logger.log('🔄 Running cleanup for expired subscriptions...');

    const users = await this.userService.findAll();

    for (const user of users) {
      const activeSubscriptions = user.subscriptions.filter(
        (sub) => !sub.expiresAt || sub.expiresAt > now,
      );

      if (activeSubscriptions.length !== user.subscriptions.length) {
        user.subscriptions = activeSubscriptions;
        await this.userService.updateUser(user._id.toString(), {
          subscriptions: user.subscriptions,
        });

        this.logger.log(
          `⚠️ Removed expired subscriptions for user ${user._id}`,
        );
      }
    }
  }
}
