import { Module } from '@nestjs/common';
import { YahooFinanceService } from './yahoo-finance.service';
import { AxiosModule } from 'src/axios/axios.module';
import { YahooFinanceController } from './yahoo-finance.controller';

@Module({
  imports: [AxiosModule],
  providers: [YahooFinanceService],
  exports: [YahooFinanceService],
  controllers: [YahooFinanceController],
})
export class YahooFinanceModule {}
