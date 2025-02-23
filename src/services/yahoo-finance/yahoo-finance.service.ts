import { Inject, Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { AxiosInstance } from 'axios';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class YahooFinanceService {
  constructor(
    @Inject('YAHOO_FINANCE_AXIOS') private readonly axios: AxiosInstance,
    private readonly configService: ConfigService,
  ) {}

  async getStockData(symbol: string): Promise<any> {
    try {
      const response = await this.axios.get(
        `/api/yahoo/finance/chart/${symbol}`,
      );
      return response.data;
    } catch (error) {
      console.error(
        'Error fetching stock data from Yahoo Finance:',
        error.message,
      );
      throw new Error('Failed to fetch stock data. Please try again later.');
    }
  }

  async getStockSummary(symbol: string): Promise<any> {
    try {
      const response = await this.axios.get(
        `/stock/get-summary?lang=en-US&symbol=${symbol}&region=US`,
      );
      return response.data;
    } catch (error) {
      console.error(
        'Error fetching stock summary from Yahoo Finance:',
        error.message,
      );
      throw new Error('Failed to fetch stock summary. Please try again later.');
    }
  }

  async getNews(): Promise<any> {
    try {
      const response = await this.axios.get(`/api/v1/markets/news`);
      return response.data;
    } catch (error) {
      console.error('Error fetching news from Yahoo Finance:', error.message);
      throw new Error('Failed to fetch news. Please try again later.');
    }
  }

  async getCalendarNews(date: string, language: string = 'en'): Promise<any> {
    try {
      const response = await this.axios.get(
        `/api/v1/markets/calendar/economic_events`,
        {
          params: { date },
        },
      );

      let events = response.data.economicEvents || [];

      // 🔍 Filter for US-only events
      events = events.filter(
        (event) => event.country?.toLowerCase() === 'United States',
      );

      // 🌍 Translate to Spanish if needed
      if (language === 'es') {
        events = await this.translateToSpanish(events);
      }

      return events;
    } catch (error) {
      console.error('Error fetching calendar news:', error.message);
      throw new HttpException(
        'Failed to fetch calendar news.',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  // 🛠 Translate Events to Spanish
  private async translateToSpanish(events: any[]): Promise<any[]> {
    return Promise.all(
      events.map(async (event) => {
        event.event = await this.translateText(event.event, 'es');
        return event;
      }),
    );
  }

  // 🌍 Function to Translate Text (Uses Google Translate API)
  private async translateText(
    text: string,
    targetLang: string,
  ): Promise<string> {
    const translateUrl =
      'https://translation.googleapis.com/language/translate/v2';
    const googleApiKey = this.configService.get<string>(
      'GOOGLE_TRANSLATE_API_KEY',
    );

    try {
      const response = await this.axios.post(
        translateUrl,
        {
          q: text,
          target: targetLang,
          source: 'en',
        },
        {
          headers: { 'Content-Type': 'application/json' },
          params: { key: googleApiKey },
        },
      );

      return response.data.data.translations[0].translatedText;
    } catch (error) {
      console.error('Translation error:', error.message);
      return text; // Return original if translation fails
    }
  }
}
