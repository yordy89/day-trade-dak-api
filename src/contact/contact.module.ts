import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ContactService } from './contact.service';
import { ContactController } from './contact.controller';
import { ContactMessage, ContactMessageSchema } from './contact-message.schema';
import { EmailModule } from '../email/email.module';
import { SettingsModule } from '../settings/settings.module';
import { WebSocketsModule } from '../websockets/websockets.module';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ContactMessage.name, schema: ContactMessageSchema },
    ]),
    EmailModule,
    SettingsModule,
    WebSocketsModule,
    NotificationModule,
  ],
  controllers: [ContactController],
  providers: [ContactService],
  exports: [ContactService],
})
export class ContactModule {}