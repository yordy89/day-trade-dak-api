import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as WebSocket from 'ws';

export interface Trade {
  s: string; // Symbol
  p: number; // Price
  t: number; // Timestamp
  v: number; // Volume
}

export interface WebSocketMessage {
  type: string;
  data?: Trade[];
}

@Injectable()
export class FinnhubWebSocketService implements OnModuleDestroy {
  private readonly logger = new Logger(FinnhubWebSocketService.name);
  private ws: WebSocket | null = null;
  private reconnectInterval: NodeJS.Timeout | null = null;
  private subscriptions: Set<string> = new Set();
  private messageHandlers: Map<string, (data: Trade[]) => void> = new Map();

  constructor(private configService: ConfigService) {}

  connect(): void {
    const apiKey = this.configService.get('FINNHUB_API_KEY');
    if (!apiKey) {
      this.logger.error('FINNHUB_API_KEY not configured');
      return;
    }

    const wsUrl = `wss://ws.finnhub.io?token=${apiKey}`;

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.on('open', () => {
        this.logger.log('WebSocket connected to Finnhub');
        this.clearReconnectInterval();

        // Resubscribe to all symbols
        this.subscriptions.forEach((symbol) => {
          this.sendMessage({ type: 'subscribe', symbol });
        });
      });

      this.ws.on('message', (data: WebSocket.Data) => {
        try {
          const message: WebSocketMessage = JSON.parse(data.toString());

          if (message.type === 'trade' && message.data) {
            // Process trades for each symbol
            const tradesBySymbol = new Map<string, Trade[]>();

            message.data.forEach((trade) => {
              if (!tradesBySymbol.has(trade.s)) {
                tradesBySymbol.set(trade.s, []);
              }
              tradesBySymbol.get(trade.s)!.push(trade);
            });

            // Call handlers for each symbol
            tradesBySymbol.forEach((trades, symbol) => {
              const handler = this.messageHandlers.get(symbol);
              if (handler) {
                handler(trades);
              }
            });
          }
        } catch (error) {
          this.logger.error('Error processing WebSocket message:', error);
        }
      });

      this.ws.on('error', (error) => {
        this.logger.error('WebSocket error:', error);
      });

      this.ws.on('close', () => {
        this.logger.warn('WebSocket connection closed');
        this.scheduleReconnect();
      });
    } catch (error) {
      this.logger.error('Error connecting to WebSocket:', error);
      this.scheduleReconnect();
    }
  }

  private sendMessage(message: any): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      this.logger.warn('WebSocket not connected, cannot send message');
    }
  }

  subscribe(symbol: string, handler: (data: Trade[]) => void): void {
    const upperSymbol = symbol.toUpperCase();
    this.subscriptions.add(upperSymbol);
    this.messageHandlers.set(upperSymbol, handler);

    this.sendMessage({ type: 'subscribe', symbol: upperSymbol });
    this.logger.log(`Subscribed to ${upperSymbol}`);
  }

  unsubscribe(symbol: string): void {
    const upperSymbol = symbol.toUpperCase();
    this.subscriptions.delete(upperSymbol);
    this.messageHandlers.delete(upperSymbol);

    this.sendMessage({ type: 'unsubscribe', symbol: upperSymbol });
    this.logger.log(`Unsubscribed from ${upperSymbol}`);
  }

  private scheduleReconnect(): void {
    if (this.reconnectInterval) {
      return;
    }

    this.reconnectInterval = setInterval(() => {
      this.logger.log('Attempting to reconnect WebSocket...');
      this.connect();
    }, 5000); // Reconnect every 5 seconds
  }

  private clearReconnectInterval(): void {
    if (this.reconnectInterval) {
      clearInterval(this.reconnectInterval);
      this.reconnectInterval = null;
    }
  }

  disconnect(): void {
    this.clearReconnectInterval();

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.subscriptions.clear();
    this.messageHandlers.clear();
  }

  onModuleDestroy(): void {
    this.disconnect();
  }

  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  getSubscriptions(): string[] {
    return Array.from(this.subscriptions);
  }
}
