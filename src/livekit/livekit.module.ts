import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule } from '@nestjs/config';
import { LiveKitController } from './livekit.controller';
import { LiveKitService } from './livekit.service';
import { Meeting, MeetingSchema } from '../schemas/meeting.schema';
import { WebSocketsModule } from '../websockets/websockets.module';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    ConfigModule,
    MongooseModule.forFeature([
      { name: Meeting.name, schema: MeetingSchema },
    ]),
    WebSocketsModule, // For emitting real-time events
    AuthModule, // For JwtService and authentication
    UsersModule, // For UserService
  ],
  controllers: [LiveKitController],
  providers: [LiveKitService],
  exports: [LiveKitService],
})
export class LiveKitModule {}