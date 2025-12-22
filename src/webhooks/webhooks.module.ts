import { Module, Global } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule } from '@nestjs/config';
import { VideoSDKWebhookController } from './videosdk-webhook.controller';
import { Meeting, MeetingSchema } from '../schemas/meeting.schema';
import { N8nWebhookService } from './n8n-webhook.service';

@Global()
@Module({
  imports: [
    ConfigModule,
    MongooseModule.forFeature([{ name: Meeting.name, schema: MeetingSchema }]),
  ],
  controllers: [VideoSDKWebhookController],
  providers: [N8nWebhookService],
  exports: [N8nWebhookService],
})
export class WebhooksModule {}
