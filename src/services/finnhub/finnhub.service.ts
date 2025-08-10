import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as finnhub from 'finnhub';

export interface MarketStatus {
  exchange: string;
  holiday: string;
  isOpen: boolean;
  timezone: string;
  t: number;
}

export interface StockQuote {
  c: number; // Current price
  d: number; // Change
  dp: number; // Percent change
  h: number; // High price of the day
  l: number; // Low price of the day
  o: number; // Open price of the day
  pc: number; // Previous close price
  t: number; // Timestamp
}

export interface CompanyProfile {
  country: string;
  currency: string;
  exchange: string;
  finnhubIndustry: string;
  ipo: string;
  logo: string;
  marketCapitalization: number;
  name: string;
  phone: string;
  shareOutstanding: number;
  ticker: string;
  weburl: string;
}

export interface EarningsCalendarItem {
  date: string;
  epsActual: number | null;
  epsEstimate: number | null;
  hour: string;
  quarter: number;
  revenueActual: number | null;
  revenueEstimate: number | null;
  symbol: string;
  year: number;
}

export interface EconomicEvent {
  actual: number | null;
  country: string;
  estimate: number | null;
  event: string;
  impact: string;
  previous: number | null;
  time: string;
  unit: string;
}

export interface NewsItem {
  category: string;
  datetime: number;
  headline: string;
  id: number;
  image: string;
  related: string;
  source: string;
  summary: string;
  url: string;
}

@Injectable()
export class FinnhubService {
  private readonly logger = new Logger(FinnhubService.name);
  private finnhubClient: any;
  private api_key: string;

  constructor(private configService: ConfigService) {
    this.api_key = this.configService.get('FINNHUB_API_KEY') || 'YOUR_API_KEY';
    
    // Log the API key status (not the actual key)
    this.logger.log(`Finnhub API Key configured: ${this.api_key ? 'Yes' : 'No'}`);
    this.logger.log(`API Key length: ${this.api_key?.length}`);

    const api_key = finnhub.ApiClient.instance.authentications['api_key'];
    api_key.apiKey = this.api_key;
    this.finnhubClient = new finnhub.DefaultApi();
  }

  /**
   * Get real-time quote for a stock symbol
   */
  async getQuote(symbol: string): Promise<StockQuote> {
    return new Promise((resolve, reject) => {
      this.finnhubClient.quote(symbol, (error: any, data: StockQuote) => {
        if (error) {
          this.logger.error(`Error fetching quote for ${symbol}:`, error);
          reject(error);
        } else {
          resolve(data);
        }
      });
    });
  }

  /**
   * Get multiple stock quotes
   */
  async getMultipleQuotes(
    symbols: string[],
  ): Promise<Record<string, StockQuote>> {
    const quotes: Record<string, StockQuote> = {};

    // Batch requests to avoid rate limiting
    const batchSize = 10;
    for (let i = 0; i < symbols.length; i += batchSize) {
      const batch = symbols.slice(i, i + batchSize);
      const promises = batch.map((symbol) =>
        this.getQuote(symbol)
          .then((quote) => ({ symbol, quote }))
          .catch((error) => {
            this.logger.error(`Failed to get quote for ${symbol}:`, error);
            return null;
          }),
      );

      const results = await Promise.all(promises);
      results.forEach((result) => {
        if (result) {
          quotes[result.symbol] = result.quote;
        }
      });

      // Add delay to respect rate limits
      if (i + batchSize < symbols.length) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    return quotes;
  }

  /**
   * Get company profile
   */
  async getCompanyProfile(symbol: string): Promise<CompanyProfile> {
    return new Promise((resolve, reject) => {
      this.finnhubClient.companyProfile2(
        { symbol },
        (error: any, data: CompanyProfile) => {
          if (error) {
            this.logger.error(
              `Error fetching company profile for ${symbol}:`,
              error,
            );
            reject(error);
          } else {
            resolve(data);
          }
        },
      );
    });
  }

  /**
   * Get market status
   */
  async getMarketStatus(exchange: string = 'US'): Promise<MarketStatus> {
    return new Promise((resolve, reject) => {
      this.finnhubClient.marketStatus(
        { exchange },
        (error: any, data: MarketStatus) => {
          if (error) {
            this.logger.error('Error fetching market status:', error);
            reject(error);
          } else {
            resolve(data);
          }
        },
      );
    });
  }

  /**
   * Get earnings calendar
   */
  async getEarningsCalendar(
    from: string,
    to: string,
    symbol?: string,
  ): Promise<EarningsCalendarItem[]> {
    return new Promise((resolve, reject) => {
      const options = symbol ? { from, to, symbol } : { from, to };

      this.finnhubClient.earningsCalendar(options, (error: any, data: any) => {
        if (error) {
          this.logger.error('Error fetching earnings calendar:', error);
          reject(error);
        } else {
          resolve(data.earningsCalendar || []);
        }
      });
    });
  }

  /**
   * Get economic calendar
   */
  async getEconomicCalendar(
    from?: string,
    to?: string,
  ): Promise<EconomicEvent[]> {
    // Economic calendar is a premium feature in Finnhub
    // Returning sample data for demonstration purposes
    this.logger.warn('Economic calendar is a premium feature. Returning sample data.');
    
    return Promise.resolve([
      {
        actual: 3.4,
        country: 'US',
        estimate: 3.3,
        event: 'CPI (Consumer Price Index)',
        impact: 'high',
        previous: 3.2,
        time: '08:30',
        unit: '%'
      },
      {
        actual: null,
        country: 'US',
        estimate: 0.25,
        event: 'Federal Reserve Interest Rate Decision',
        impact: 'high',
        previous: 0.25,
        time: '14:00',
        unit: '%'
      },
      {
        actual: 250,
        country: 'US',
        estimate: 245,
        event: 'Non-Farm Payrolls',
        impact: 'high',
        previous: 223,
        time: '08:30',
        unit: 'K'
      },
      {
        actual: 2.1,
        country: 'EU',
        estimate: 2.2,
        event: 'GDP Growth Rate',
        impact: 'medium',
        previous: 2.0,
        time: '10:00',
        unit: '%'
      },
      {
        actual: null,
        country: 'UK',
        estimate: 51.2,
        event: 'Manufacturing PMI',
        impact: 'medium',
        previous: 50.8,
        time: '09:30',
        unit: ''
      },
      {
        actual: 3.8,
        country: 'US',
        estimate: 3.9,
        event: 'Unemployment Rate',
        impact: 'high',
        previous: 4.0,
        time: '08:30',
        unit: '%'
      },
      {
        actual: null,
        country: 'JP',
        estimate: -0.1,
        event: 'Bank of Japan Interest Rate',
        impact: 'medium',
        previous: -0.1,
        time: '03:00',
        unit: '%'
      },
      {
        actual: 65.2,
        country: 'US',
        estimate: 64.8,
        event: 'Consumer Confidence Index',
        impact: 'medium',
        previous: 64.5,
        time: '10:00',
        unit: ''
      }
    ]);
  }

  /**
   * Get market news
   */
  async getMarketNews(category: string = 'general'): Promise<NewsItem[]> {
    return new Promise((resolve, reject) => {
      this.finnhubClient.marketNews(
        category,
        {},
        (error: any, data: NewsItem[]) => {
          if (error) {
            this.logger.error('Error fetching market news:', error);
            reject(error);
          } else {
            resolve(data);
          }
        },
      );
    });
  }

  /**
   * Get company news
   */
  async getCompanyNews(
    symbol: string,
    from: string,
    to: string,
  ): Promise<NewsItem[]> {
    return new Promise((resolve, reject) => {
      this.finnhubClient.companyNews(
        symbol,
        from,
        to,
        (error: any, data: NewsItem[]) => {
          if (error) {
            this.logger.error(`Error fetching news for ${symbol}:`, error);
            reject(error);
          } else {
            resolve(data);
          }
        },
      );
    });
  }

  /**
   * Search for symbols
   */
  async searchSymbols(query: string): Promise<any> {
    return new Promise((resolve, reject) => {
      this.finnhubClient.symbolSearch(query, (error: any, data: any) => {
        if (error) {
          this.logger.error('Error searching symbols:', error);
          reject(error);
        } else {
          resolve(data);
        }
      });
    });
  }

  /**
   * Get stock candles (OHLC data)
   */
  async getStockCandles(
    symbol: string,
    resolution: string,
    from: number,
    to: number,
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      this.finnhubClient.stockCandles(
        symbol,
        resolution,
        from,
        to,
        (error: any, data: any) => {
          if (error) {
            this.logger.error(`Error fetching candles for ${symbol}:`, error);
            reject(error);
          } else {
            resolve(data);
          }
        },
      );
    });
  }
}
