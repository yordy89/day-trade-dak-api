import { Module, Global } from '@nestjs/common';
import { WebSocketGateway } from './websockets.gateway';
import { MongooseModule } from '@nestjs/mongoose';
import { Meeting, MeetingSchema } from '../schemas/meeting.schema';

@Global()
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Meeting.name, schema: MeetingSchema },
    ]),
  ],
  providers: [WebSocketGateway],
  exports: [WebSocketGateway],
})
export class WebSocketsModule {}