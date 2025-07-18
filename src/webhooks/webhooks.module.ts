import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { VideoSDKWebhookController } from './videosdk-webhook.controller';
import { Meeting, MeetingSchema } from '../schemas/meeting.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Meeting.name, schema: MeetingSchema },
    ]),
  ],
  controllers: [VideoSDKWebhookController],
})
export class WebhooksModule {}