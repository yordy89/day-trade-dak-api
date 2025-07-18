import {
  Controller,
  Get,
  Query,
  Param,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { FinnhubService } from './finnhub.service';
import { JwtAuthGuard } from 'src/guards/jwt-auth-guard';

@Controller('market')
@UseGuards(JwtAuthGuard)
export class FinnhubController {
  constructor(private readonly finnhubService: FinnhubService) {}

  /**
   * Get real-time quote for a symbol
   */
  @Get('quote/:symbol')
  async getQuote(@Param('symbol') symbol: string) {
    if (!symbol) {
      throw new BadRequestException('Symbol is required');
    }
    return this.finnhubService.getQuote(symbol.toUpperCase());
  }

  /**
   * Get multiple quotes
   */
  @Get('quotes')
  async getMultipleQuotes(@Query('symbols') symbols: string) {
    if (!symbols) {
      throw new BadRequestException('Symbols are required');
    }

    const symbolArray = symbols.split(',').map((s) => s.trim().toUpperCase());
    return this.finnhubService.getMultipleQuotes(symbolArray);
  }

  /**
   * Get company profile
   */
  @Get('company/:symbol')
  async getCompanyProfile(@Param('symbol') symbol: string) {
    if (!symbol) {
      throw new BadRequestException('Symbol is required');
    }
    return this.finnhubService.getCompanyProfile(symbol.toUpperCase());
  }

  /**
   * Get market status
   */
  @Get('status')
  async getMarketStatus(@Query('exchange') exchange?: string) {
    return this.finnhubService.getMarketStatus(exchange);
  }

  /**
   * Get earnings calendar
   */
  @Get('earnings')
  async getEarningsCalendar(
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('symbol') symbol?: string,
  ) {
    if (!from || !to) {
      throw new BadRequestException('From and to dates are required');
    }
    return this.finnhubService.getEarningsCalendar(from, to, symbol);
  }

  /**
   * Get economic calendar
   */
  @Get('economic-calendar')
  async getEconomicCalendar(
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.finnhubService.getEconomicCalendar(from, to);
  }

  /**
   * Get market news
   */
  @Get('news')
  async getMarketNews(@Query('category') category?: string) {
    return this.finnhubService.getMarketNews(category);
  }

  /**
   * Get company news
   */
  @Get('news/:symbol')
  async getCompanyNews(
    @Param('symbol') symbol: string,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    if (!symbol || !from || !to) {
      throw new BadRequestException('Symbol, from and to dates are required');
    }
    return this.finnhubService.getCompanyNews(symbol.toUpperCase(), from, to);
  }

  /**
   * Search symbols
   */
  @Get('search')
  async searchSymbols(@Query('q') query: string) {
    if (!query) {
      throw new BadRequestException('Query is required');
    }
    return this.finnhubService.searchSymbols(query);
  }

  /**
   * Get stock candles (OHLC data)
   */
  @Get('candles/:symbol')
  async getStockCandles(
    @Param('symbol') symbol: string,
    @Query('resolution') resolution: string,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    if (!symbol || !resolution || !from || !to) {
      throw new BadRequestException(
        'Symbol, resolution, from and to are required',
      );
    }

    const fromTimestamp = parseInt(from);
    const toTimestamp = parseInt(to);

    if (isNaN(fromTimestamp) || isNaN(toTimestamp)) {
      throw new BadRequestException('From and to must be valid timestamps');
    }

    return this.finnhubService.getStockCandles(
      symbol.toUpperCase(),
      resolution,
      fromTimestamp,
      toTimestamp,
    );
  }

  /**
   * Get popular stocks with quotes
   */
  @Get('popular')
  async getPopularStocks() {
    const popularSymbols = [
      'AAPL',
      'MSFT',
      'GOOGL',
      'AMZN',
      'TSLA',
      'META',
      'NVDA',
      'JPM',
      'V',
      'JNJ',
      'WMT',
      'PG',
      'UNH',
      'HD',
      'DIS',
      'MA',
      'PYPL',
      'BAC',
      'NFLX',
      'ADBE',
    ];

    return this.finnhubService.getMultipleQuotes(popularSymbols);
  }
}
