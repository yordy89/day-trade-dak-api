import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Campaign, CampaignSchema } from './schemas/campaign.schema';
import { EmailTemplate, EmailTemplateSchema } from './schemas/email-template.schema';
import { CampaignAnalytics, CampaignAnalyticsSchema } from './schemas/campaign-analytics.schema';
import { RecipientSegment, RecipientSegmentSchema } from './schemas/recipient-segment.schema';
import { CampaignService } from './services/campaign.service';
import { TemplateService } from './services/template.service';
import { RecipientService } from './services/recipient.service';
import { AnalyticsService } from './services/analytics.service';
import { CampaignController } from './controllers/campaign.controller';
import { TemplateController } from './controllers/template.controller';
import { RecipientController, SegmentController } from './controllers/recipient.controller';
import { AnalyticsController } from './controllers/analytics.controller';
import { TrackingController } from './controllers/tracking.controller';
import { User, UserSchema } from '../users/user.schema';
import { EventRegistration, EventRegistrationSchema } from '../event/schemas/eventRegistration.schema';
import { EmailModule } from '../email/email.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Campaign.name, schema: CampaignSchema },
      { name: EmailTemplate.name, schema: EmailTemplateSchema },
      { name: CampaignAnalytics.name, schema: CampaignAnalyticsSchema },
      { name: RecipientSegment.name, schema: RecipientSegmentSchema },
      { name: User.name, schema: UserSchema },
      { name: EventRegistration.name, schema: EventRegistrationSchema },
    ]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET') || 'yourSecretKey',
        signOptions: { expiresIn: '24h' },
      }),
    }),
    EmailModule,
    forwardRef(() => UsersModule),
  ],
  controllers: [
    CampaignController,
    TemplateController,
    RecipientController,
    SegmentController,
    AnalyticsController,
    TrackingController,
  ],
  providers: [CampaignService, TemplateService, RecipientService, AnalyticsService],
  exports: [CampaignService, TemplateService, RecipientService, AnalyticsService],
})
export class EmailMarketingModule {}