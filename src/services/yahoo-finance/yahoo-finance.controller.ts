import { Controller, Get, Query } from '@nestjs/common';
import { YahooFinanceService } from './yahoo-finance.service';

@Controller('yahoo-finance')
export class YahooFinanceController {
  constructor(private readonly yahooFinanceService: YahooFinanceService) {}

  @Get('stock')
  async getStock(@Query('symbol') symbol: string): Promise<any> {
    return this.yahooFinanceService.getStockData(symbol);
  }

  @Get('news')
  async getNews(): Promise<any> {
    return this.yahooFinanceService.getNews();
  }

  @Get('calendar')
  async getCalendarNews(
    @Query('date') date: string,
    @Query('language') language: string,
  ): Promise<any> {
    return this.yahooFinanceService.getCalendarNews(date, language);
  }
}
