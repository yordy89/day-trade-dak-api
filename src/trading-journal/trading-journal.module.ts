import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TradingJournalService } from './trading-journal.service';
import { TradingJournalController } from './trading-journal.controller';
import { Trade, TradeSchema } from './schemas/trade.schema';
import { Feedback, FeedbackSchema } from './schemas/feedback.schema';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'JournalTrade', schema: TradeSchema },
      { name: Feedback.name, schema: FeedbackSchema },
    ]),
    forwardRef(() => UsersModule),
  ],
  controllers: [TradingJournalController],
  providers: [TradingJournalService],
  exports: [TradingJournalService],
})
export class TradingJournalModule {}