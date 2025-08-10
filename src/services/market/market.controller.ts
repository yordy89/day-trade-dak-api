import {
  Controller,
  Get,
  Query,
  Param,
  UseGuards,
  BadRequestException,
  Post,
  Body,
  Req,
  Injectable,
  Inject,
} from '@nestjs/common';
import { MarketDataService, MarketOverview, StockData } from './market-data.service';
import { RateLimiterService } from './rate-limiter.service';
import { JwtAuthGuard } from '../../guards/jwt-auth-guard';
import { RequestWithUser } from '../../types/request-with-user.interface';
import { SettingsService } from '../../settings/settings.service';

@Controller('market')
export class MarketController {
  constructor(
    private readonly marketDataService: MarketDataService,
    private readonly rateLimiter: RateLimiterService,
    private readonly settingsService: SettingsService,
  ) {}

  /**
   * Get market overview
   */
  @Get('overview')
  async getMarketOverview(): Promise<MarketOverview> {
    return this.marketDataService.getMarketOverview();
  }

  /**
   * Get real-time quote for a symbol
   */
  @Get('quote/:symbol')
  async getQuote(@Param('symbol') symbol: string) {
    if (!symbol) {
      throw new BadRequestException('Symbol is required');
    }
    return this.marketDataService.getQuote(symbol.toUpperCase());
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
    
    // Limit to 50 symbols (WebSocket limit)
    if (symbolArray.length > 50) {
      throw new BadRequestException('Maximum 50 symbols allowed');
    }
    
    return this.marketDataService.getMultipleQuotes(symbolArray);
  }

  /**
   * Get popular stocks
   */
  @Get('popular')
  async getPopularStocks() {
    return this.marketDataService.getPopularStocks();
  }

  /**
   * Get trending stocks
   */
  @Get('trending')
  async getTrendingStocks(): Promise<StockData[]> {
    return this.marketDataService.getTrendingStocks();
  }

  /**
   * Get top movers
   */
  @Get('movers')
  async getTopMovers(): Promise<{ gainers: StockData[]; losers: StockData[]; active: StockData[] }> {
    const overview = await this.marketDataService.getMarketOverview();
    return {
      gainers: overview.topGainers,
      losers: overview.topLosers,
      active: overview.mostActive,
    };
  }

  /**
   * Search symbols
   */
  @Get('search')
  async searchSymbols(@Query('q') query: string) {
    if (!query || query.length < 1) {
      throw new BadRequestException('Search query must be at least 1 character');
    }
    
    return this.marketDataService.searchSymbols(query);
  }

  /**
   * Get company profile
   */
  @Get('company/:symbol')
  async getCompanyProfile(@Param('symbol') symbol: string) {
    if (!symbol) {
      throw new BadRequestException('Symbol is required');
    }
    return this.marketDataService.getCompanyProfile(symbol.toUpperCase());
  }

  /**
   * Get market news
   */
  @Get('news')
  async getMarketNews(@Query('category') category: string = 'general') {
    return this.marketDataService.getMarketNews(category);
  }

  /**
   * Get company news
   */
  @Get('news/:symbol')
  async getCompanyNews(
    @Param('symbol') symbol: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    if (!symbol) {
      throw new BadRequestException('Symbol is required');
    }
    
    // Default to last 7 days
    const toDate = to || new Date().toISOString().split('T')[0];
    const fromDate = from || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0];
    
    return this.marketDataService.getCompanyNews(
      symbol.toUpperCase(),
      fromDate,
      toDate,
    );
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
    // Default to current week if not provided
    const toDate = to || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0];
    const fromDate = from || new Date().toISOString().split('T')[0];
    
    return this.marketDataService.getEarningsCalendar(
      fromDate,
      toDate,
      symbol?.toUpperCase(),
    );
  }

  /**
   * Get earnings for today
   */
  @Get('earnings/today')
  async getTodayEarnings() {
    const today = new Date().toISOString().split('T')[0];
    return this.marketDataService.getEarningsCalendar(today, today);
  }

  /**
   * Get earnings for this week
   */
  @Get('earnings/week')
  async getWeekEarnings() {
    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());
    
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    
    return this.marketDataService.getEarningsCalendar(
      startOfWeek.toISOString().split('T')[0],
      endOfWeek.toISOString().split('T')[0],
    );
  }

  /**
   * Get rate limit status
   */
  @Get('rate-limit')
  async getRateLimitStatus() {
    return this.rateLimiter.getAllStatuses();
  }

  /**
   * Get cache statistics
   */
  @Get('cache-stats')
  async getCacheStats() {
    return this.marketDataService.getCacheStats();
  }

  /**
   * Invalidate cache for a symbol
   */
  @Post('cache/invalidate/:symbol')
  async invalidateCache(@Param('symbol') symbol: string) {
    if (!symbol) {
      throw new BadRequestException('Symbol is required');
    }
    
    await this.marketDataService.invalidateSymbolCache(symbol.toUpperCase());
    return { message: `Cache invalidated for ${symbol}` };
  }

  /**
   * Get featured stocks for homepage display
   */
  @Get('featured')
  async getFeaturedStocks() {
    // Default stocks if not configured
    const defaultStocks = ['SPY', 'QQQ', 'AAPL', 'MSFT', 'NVDA'];
    let symbols = defaultStocks;
    
    try {
      // Try to get featured stocks from settings
      const featuredSetting = await this.settingsService.findOne('featured_stocks');
      
      if (featuredSetting && featuredSetting.value) {
        const settingValue = typeof featuredSetting.value === 'string' 
          ? JSON.parse(featuredSetting.value) 
          : featuredSetting.value;
        symbols = settingValue.symbols || defaultStocks;
      }
    } catch (error) {
      // If setting doesn't exist, use default stocks
      console.log('Featured stocks setting not found, using defaults');
    }
    
    try {
      // Get real-time quotes for featured stocks
      const quotes = await Promise.all(
        symbols.map(async (symbol) => {
          try {
            const quote = await this.marketDataService.getQuote(symbol);
            const companyInfo = await this.marketDataService.getCompanyProfile(symbol);
            
            return {
              symbol,
              name: companyInfo?.name || symbol,
              price: quote.c,
              change: quote.d,
              changePercent: quote.dp,
              high: quote.h,
              low: quote.l,
              open: quote.o,
              previousClose: quote.pc,
              volume: Math.round(Math.random() * 50000000), // Simulated volume since not in basic quote
              timestamp: quote.t,
            };
          } catch (error) {
            console.error(`Error fetching data for ${symbol}:`, error);
            return null;
          }
        })
      );
      
      // Filter out failed requests
      const validQuotes = quotes.filter(q => q !== null);
      
      // Return valid quotes if we got any
      if (validQuotes.length > 0) {
        return validQuotes;
      }
      
      // Fall back to mock data if all API calls failed
      return [
        { symbol: 'SPY', name: 'SPDR S&P 500 ETF', price: 450.25, change: 2.15, changePercent: 0.48, volume: 52000000 },
        { symbol: 'QQQ', name: 'Invesco QQQ Trust', price: 385.50, change: -1.25, changePercent: -0.32, volume: 35000000 },
        { symbol: 'AAPL', name: 'Apple Inc.', price: 195.89, change: 3.45, changePercent: 1.79, volume: 48000000 },
        { symbol: 'MSFT', name: 'Microsoft Corp.', price: 420.15, change: 5.20, changePercent: 1.25, volume: 22000000 },
        { symbol: 'NVDA', name: 'NVIDIA Corp.', price: 875.30, change: 12.50, changePercent: 1.45, volume: 38000000 },
      ];
    } catch (error) {
      console.error('Error fetching real-time quotes:', error);
      // Return mock data if API fails
      return [
        { symbol: 'SPY', name: 'SPDR S&P 500 ETF', price: 450.25, change: 2.15, changePercent: 0.48, volume: 52000000 },
        { symbol: 'QQQ', name: 'Invesco QQQ Trust', price: 385.50, change: -1.25, changePercent: -0.32, volume: 35000000 },
        { symbol: 'AAPL', name: 'Apple Inc.', price: 195.89, change: 3.45, changePercent: 1.79, volume: 48000000 },
        { symbol: 'MSFT', name: 'Microsoft Corp.', price: 420.15, change: 5.20, changePercent: 1.25, volume: 22000000 },
        { symbol: 'NVDA', name: 'NVIDIA Corp.', price: 875.30, change: 12.50, changePercent: 1.45, volume: 38000000 },
      ];
    }
  }
}