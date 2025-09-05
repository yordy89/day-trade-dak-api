import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { StripeModule } from 'src/payments/stripe/stripe.module';
import { CronService } from './cron.service';
import { SubscriptionSyncCron } from './subscription-sync.cron';
import { CronController } from './cron.controller';
import { UsersModule } from 'src/users/users.module';
import { EmailModule } from 'src/email/email.module';
import { AuthModule } from 'src/auth/auth.module';
import { GuardsModule } from 'src/guards/guards.module';
import { UserSchema } from 'src/users/user.schema';
import { TransactionSchema } from 'src/payments/stripe/transaction.schema';
import { SubscriptionHistorySchema } from 'src/payments/stripe/subscription-history.schema';
import { ModulePermissionsModule } from 'src/module-permissions/module-permissions.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'User', schema: UserSchema },
      { name: 'Transaction', schema: TransactionSchema },
      { name: 'SubscriptionHistory', schema: SubscriptionHistorySchema },
    ]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: '7d' },
      }),
    }),
    StripeModule,
    UsersModule,
    EmailModule,
    AuthModule,
    GuardsModule,
    ModulePermissionsModule,
  ],
  controllers: [CronController],
  providers: [CronService, SubscriptionSyncCron],
  exports: [SubscriptionSyncCron],
})
export class CronModule {}
