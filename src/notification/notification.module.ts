import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { NotificationService } from './notification.service';
import { Notification, NotificationSchema } from './notification.schema';
import { WebSocketsModule } from '../websockets/websockets.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Notification.name, schema: NotificationSchema },
    ]),
    WebSocketsModule,
  ],
  providers: [NotificationService],
  exports: [NotificationService],
})
export class NotificationModule {}