import { Module } from '@nestjs/common';
import { NewsletterController } from './newsletter.controller';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [EmailModule],
  controllers: [NewsletterController],
})
export class NewsletterModule {}