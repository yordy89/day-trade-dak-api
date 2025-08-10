import { Injectable, Logger } from '@nestjs/common';
import { FinnhubService, StockQuote, CompanyProfile, NewsItem, EarningsCalendarItem } from '../finnhub/finnhub.service';
import { CacheService } from '../../cache/cache.service';

export interface MarketOverview {
  indices: Record<string, StockQuote>;
  topGainers: StockData[];
  topLosers: StockData[];
  mostActive: StockData[];
  marketStatus: any;
}

export interface StockData {
  symbol: string;
  name?: string;
  price: number;
  change: number;
  changePercent: number;
  volume?: number;
}

export interface CachedQuote extends StockQuote {
  cachedAt: number;
}

@Injectable()
export class MarketDataService {
  private readonly logger = new Logger(MarketDataService.name);
  
  // Cache TTL settings (in seconds)
  private readonly QUOTE_TTL = 15; // 15 seconds for quotes
  private readonly COMPANY_TTL = 86400; // 24 hours for company info
  private readonly NEWS_TTL = 300; // 5 minutes for news
  private readonly EARNINGS_TTL = 3600; // 1 hour for earnings
  
  // Popular symbols for tracking
  private readonly POPULAR_SYMBOLS = [
    'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA', 'META', 'NVDA', 
    'JPM', 'V', 'JNJ', 'WMT', 'PG', 'UNH', 'HD', 'MA',
    'DIS', 'BAC', 'NFLX', 'ADBE', 'CRM', 'NKE', 'MCD', 'PFE',
    'TMO', 'ABT', 'COST', 'CVX', 'WFC', 'AVGO', 'LLY'
  ];
  
  private readonly INDEX_SYMBOLS = ['SPY', 'QQQ', 'DIA', 'IWM', 'VTI'];

  constructor(
    private finnhubService: FinnhubService,
    private cacheService: CacheService,
  ) {}

  /**
   * Get quote with caching
   */
  async getQuote(symbol: string): Promise<StockQuote> {
    const cacheKey = `quote:${symbol}`;
    
    // Check cache first
    const cached = await this.cacheService.get<CachedQuote>(cacheKey);
    if (cached && this.isCacheValid(cached.cachedAt, this.QUOTE_TTL)) {
      this.logger.debug(`Cache hit for quote: ${symbol}`);
      return cached;
    }
    
    // Fetch from API
    try {
      const quote = await this.finnhubService.getQuote(symbol);
      
      // Cache the result
      const cachedQuote: CachedQuote = {
        ...quote,
        cachedAt: Date.now(),
      };
      await this.cacheService.set(cacheKey, cachedQuote, this.QUOTE_TTL);
      
      return quote;
    } catch (error) {
      this.logger.error(`Error fetching quote for ${symbol}:`, error);
      
      // Return cached data even if expired
      if (cached) {
        this.logger.warn(`Returning stale cache for ${symbol}`);
        return cached;
      }
      
      throw error;
    }
  }

  /**
   * Get multiple quotes with caching
   */
  async getMultipleQuotes(symbols: string[]): Promise<Record<string, StockQuote>> {
    const quotes: Record<string, StockQuote> = {};
    const uncachedSymbols: string[] = [];
    
    // Check cache for each symbol
    for (const symbol of symbols) {
      const cacheKey = `quote:${symbol}`;
      const cached = await this.cacheService.get<CachedQuote>(cacheKey);
      
      if (cached && this.isCacheValid(cached.cachedAt, this.QUOTE_TTL)) {
        quotes[symbol] = cached;
      } else {
        uncachedSymbols.push(symbol);
      }
    }
    
    // Fetch uncached symbols
    if (uncachedSymbols.length > 0) {
      try {
        const freshQuotes = await this.finnhubService.getMultipleQuotes(uncachedSymbols);
        
        // Cache and add to results
        for (const [symbol, quote] of Object.entries(freshQuotes)) {
          const cacheKey = `quote:${symbol}`;
          const cachedQuote: CachedQuote = {
            ...quote,
            cachedAt: Date.now(),
          };
          await this.cacheService.set(cacheKey, cachedQuote, this.QUOTE_TTL);
          quotes[symbol] = quote;
        }
      } catch (error) {
        this.logger.error('Error fetching multiple quotes:', error);
      }
    }
    
    return quotes;
  }

  /**
   * Get company profile with caching
   */
  async getCompanyProfile(symbol: string): Promise<CompanyProfile> {
    const cacheKey = `company:${symbol}`;
    
    // Check cache
    const cached = await this.cacheService.get<CompanyProfile>(cacheKey);
    if (cached) {
      return cached;
    }
    
    // Fetch from API
    try {
      const profile = await this.finnhubService.getCompanyProfile(symbol);
      
      // Cache for 24 hours
      await this.cacheService.set(cacheKey, profile, this.COMPANY_TTL);
      
      return profile;
    } catch (error) {
      this.logger.error(`Error fetching company profile for ${symbol}:`, error);
      throw error;
    }
  }

  /**
   * Get market overview with popular stocks
   */
  async getMarketOverview(): Promise<MarketOverview> {
    try {
      // Get index quotes
      const indices = await this.getMultipleQuotes(this.INDEX_SYMBOLS);
      
      // Get popular stock quotes
      const popularQuotes = await this.getMultipleQuotes(this.POPULAR_SYMBOLS);
      
      // Calculate gainers and losers
      const stocksWithChange = Object.entries(popularQuotes)
        .map(([symbol, quote]) => ({
          symbol,
          price: quote.c,
          change: quote.d,
          changePercent: quote.dp,
        }))
        .filter(stock => stock.change !== 0);
      
      // Sort for top gainers and losers
      const topGainers = [...stocksWithChange]
        .filter(s => s.change > 0)
        .sort((a, b) => b.changePercent - a.changePercent)
        .slice(0, 5);
      
      const topLosers = [...stocksWithChange]
        .filter(s => s.change < 0)
        .sort((a, b) => a.changePercent - b.changePercent)
        .slice(0, 5);
      
      // Get most active (using price * volume approximation)
      const mostActive = [...stocksWithChange]
        .sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent))
        .slice(0, 5);
      
      // Get market status - simplified for now to avoid API issues
      const marketStatus = { isOpen: true, exchange: 'US' };
      
      return {
        indices,
        topGainers,
        topLosers,
        mostActive,
        marketStatus,
      };
    } catch (error) {
      this.logger.error('Error getting market overview:', error);
      throw error;
    }
  }

  /**
   * Get popular stocks
   */
  async getPopularStocks(): Promise<Record<string, StockQuote>> {
    return this.getMultipleQuotes(this.POPULAR_SYMBOLS);
  }

  /**
   * Search symbols
   */
  async searchSymbols(query: string): Promise<any> {
    const cacheKey = `search:${query.toLowerCase()}`;
    
    // Check cache
    const cached = await this.cacheService.get(cacheKey);
    if (cached) {
      return cached;
    }
    
    try {
      const results = await this.finnhubService.searchSymbols(query);
      
      // Cache for 1 hour
      await this.cacheService.set(cacheKey, results, 3600);
      
      return results;
    } catch (error) {
      this.logger.error(`Error searching symbols for "${query}":`, error);
      throw error;
    }
  }

  /**
   * Get earnings calendar with caching
   */
  async getEarningsCalendar(
    from: string,
    to: string,
    symbol?: string,
  ): Promise<EarningsCalendarItem[]> {
    const cacheKey = symbol 
      ? `earnings:${symbol}:${from}:${to}`
      : `earnings:${from}:${to}`;
    
    // Check cache
    const cached = await this.cacheService.get<EarningsCalendarItem[]>(cacheKey);
    if (cached) {
      return cached;
    }
    
    try {
      const earnings = await this.finnhubService.getEarningsCalendar(from, to, symbol);
      
      // Cache for 1 hour
      await this.cacheService.set(cacheKey, earnings, this.EARNINGS_TTL);
      
      return earnings;
    } catch (error) {
      this.logger.error('Error fetching earnings calendar:', error);
      throw error;
    }
  }

  /**
   * Get market news with caching
   */
  async getMarketNews(category: string = 'general'): Promise<NewsItem[]> {
    const cacheKey = `news:market:${category}`;
    
    // Check cache
    const cached = await this.cacheService.get<NewsItem[]>(cacheKey);
    if (cached) {
      return cached;
    }
    
    try {
      const news = await this.finnhubService.getMarketNews(category);
      
      // Cache for 5 minutes
      await this.cacheService.set(cacheKey, news, this.NEWS_TTL);
      
      return news;
    } catch (error) {
      this.logger.error('Error fetching market news:', error);
      throw error;
    }
  }

  /**
   * Get company news with caching
   */
  async getCompanyNews(
    symbol: string,
    from: string,
    to: string,
  ): Promise<NewsItem[]> {
    const cacheKey = `news:company:${symbol}:${from}:${to}`;
    
    // Check cache
    const cached = await this.cacheService.get<NewsItem[]>(cacheKey);
    if (cached) {
      return cached;
    }
    
    try {
      const news = await this.finnhubService.getCompanyNews(symbol, from, to);
      
      // Cache for 5 minutes
      await this.cacheService.set(cacheKey, news, this.NEWS_TTL);
      
      return news;
    } catch (error) {
      this.logger.error(`Error fetching news for ${symbol}:`, error);
      throw error;
    }
  }

  /**
   * Get trending stocks (based on volume and price changes)
   */
  async getTrendingStocks(): Promise<StockData[]> {
    const cacheKey = 'trending:stocks';
    
    // Check cache
    const cached = await this.cacheService.get<StockData[]>(cacheKey);
    if (cached) {
      return cached;
    }
    
    try {
      const quotes = await this.getPopularStocks();
      
      // Sort by absolute change percentage
      const trending = Object.entries(quotes)
        .map(([symbol, quote]) => ({
          symbol,
          price: quote.c,
          change: quote.d,
          changePercent: quote.dp,
        }))
        .sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent))
        .slice(0, 10);
      
      // Cache for 1 minute
      await this.cacheService.set(cacheKey, trending, 60);
      
      return trending;
    } catch (error) {
      this.logger.error('Error getting trending stocks:', error);
      throw error;
    }
  }

  /**
   * Check if cache is still valid
   */
  private isCacheValid(cachedAt: number, ttl: number): boolean {
    const age = (Date.now() - cachedAt) / 1000;
    return age < ttl;
  }

  /**
   * Invalidate cache for a symbol
   */
  async invalidateSymbolCache(symbol: string): Promise<void> {
    const keys = [
      `quote:${symbol}`,
      `company:${symbol}`,
      `news:company:${symbol}:*`,
    ];
    
    for (const key of keys) {
      if (key.includes('*')) {
        await this.cacheService.invalidatePattern(key);
      } else {
        await this.cacheService.del(key);
      }
    }
  }

  /**
   * Get cache statistics
   */
  async getCacheStats(): Promise<any> {
    const patterns = [
      'quote:*',
      'company:*',
      'news:*',
      'earnings:*',
      'search:*',
    ];
    
    const stats: Record<string, number> = {};
    
    for (const pattern of patterns) {
      const keys = await this.cacheService.keys(pattern);
      const type = pattern.split(':')[0];
      stats[type] = keys.length;
    }
    
    return {
      ...stats,
      total: Object.values(stats).reduce((sum, count) => sum + count, 0),
    };
  }
}