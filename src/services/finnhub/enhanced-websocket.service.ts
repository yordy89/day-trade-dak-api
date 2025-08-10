import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as WebSocket from 'ws';
import { EventEmitter } from 'events';

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

interface SymbolSubscription {
  symbol: string;
  priority: number;
  lastAccessed: number;
  subscriberCount: number;
}

@Injectable()
export class EnhancedWebSocketService implements OnModuleDestroy {
  private readonly logger = new Logger(EnhancedWebSocketService.name);
  private ws: WebSocket | null = null;
  private reconnectInterval: NodeJS.Timeout | null = null;
  
  // Manage 50 symbol limit efficiently
  private readonly MAX_SYMBOLS = 50;
  private subscriptions: Map<string, SymbolSubscription> = new Map();
  private symbolEmitter: EventEmitter = new EventEmitter();
  
  // Connection state
  private isConnected = false;
  private connectionAttempts = 0;
  private readonly MAX_RECONNECT_ATTEMPTS = 10;

  constructor(private configService: ConfigService) {
    this.connect();
  }

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
        this.isConnected = true;
        this.connectionAttempts = 0;
        this.clearReconnectInterval();

        // Resubscribe to active symbols
        this.resubscribeActiveSymbols();
      });

      this.ws.on('message', (data: WebSocket.Data) => {
        this.handleMessage(data);
      });

      this.ws.on('error', (error) => {
        this.logger.error('WebSocket error:', error);
        this.isConnected = false;
      });

      this.ws.on('close', () => {
        this.logger.warn('WebSocket connection closed');
        this.isConnected = false;
        this.scheduleReconnect();
      });

      this.ws.on('ping', () => {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          this.ws.pong();
        }
      });
    } catch (error) {
      this.logger.error('Error connecting to WebSocket:', error);
      this.scheduleReconnect();
    }
  }

  private handleMessage(data: WebSocket.Data): void {
    try {
      const message: WebSocketMessage = JSON.parse(data.toString());

      if (message.type === 'trade' && message.data) {
        // Group trades by symbol
        const tradesBySymbol = new Map<string, Trade[]>();

        message.data.forEach((trade) => {
          if (!tradesBySymbol.has(trade.s)) {
            tradesBySymbol.set(trade.s, []);
          }
          tradesBySymbol.get(trade.s)!.push(trade);
          
          // Update last accessed time
          const subscription = this.subscriptions.get(trade.s);
          if (subscription) {
            subscription.lastAccessed = Date.now();
          }
        });

        // Emit trades for each symbol
        tradesBySymbol.forEach((trades, symbol) => {
          this.symbolEmitter.emit(symbol, trades);
        });
      }
    } catch (error) {
      this.logger.error('Error processing WebSocket message:', error);
    }
  }

  /**
   * Subscribe to a symbol with priority management
   */
  subscribe(
    symbol: string,
    callback: (trades: Trade[]) => void,
    priority: number = 1,
  ): () => void {
    const upperSymbol = symbol.toUpperCase();
    
    let subscription = this.subscriptions.get(upperSymbol);
    
    if (!subscription) {
      subscription = {
        symbol: upperSymbol,
        priority,
        lastAccessed: Date.now(),
        subscriberCount: 0,
      };
      this.subscriptions.set(upperSymbol, subscription);
    }
    
    subscription.subscriberCount++;
    subscription.priority = Math.max(subscription.priority, priority);
    
    // Add listener
    this.symbolEmitter.on(upperSymbol, callback);
    
    // Manage symbol limit
    this.manageSymbolLimit();
    
    // Subscribe if within limit and connected
    if (this.isConnected && this.canSubscribe(upperSymbol)) {
      this.sendMessage({ type: 'subscribe', symbol: upperSymbol });
      this.logger.debug(`Subscribed to ${upperSymbol} (priority: ${priority})`);
    }
    
    // Return unsubscribe function
    return () => {
      this.unsubscribe(upperSymbol, callback);
    };
  }

  /**
   * Unsubscribe from a symbol
   */
  private unsubscribe(symbol: string, callback: (trades: Trade[]) => void): void {
    const upperSymbol = symbol.toUpperCase();
    
    // Remove listener
    this.symbolEmitter.removeListener(upperSymbol, callback);
    
    const subscription = this.subscriptions.get(upperSymbol);
    if (subscription) {
      subscription.subscriberCount--;
      
      // Remove subscription if no more subscribers
      if (subscription.subscriberCount <= 0) {
        this.subscriptions.delete(upperSymbol);
        
        if (this.isConnected) {
          this.sendMessage({ type: 'unsubscribe', symbol: upperSymbol });
          this.logger.debug(`Unsubscribed from ${upperSymbol}`);
        }
      }
    }
  }

  /**
   * Manage symbol limit by prioritizing active symbols
   */
  private manageSymbolLimit(): void {
    if (this.subscriptions.size <= this.MAX_SYMBOLS) {
      return;
    }
    
    // Sort by priority and last accessed
    const sorted = Array.from(this.subscriptions.values()).sort((a, b) => {
      // Higher priority first
      if (a.priority !== b.priority) {
        return b.priority - a.priority;
      }
      // More recently accessed first
      return b.lastAccessed - a.lastAccessed;
    });
    
    // Keep top symbols
    const toKeep = sorted.slice(0, this.MAX_SYMBOLS);
    const toRemove = sorted.slice(this.MAX_SYMBOLS);
    
    // Unsubscribe from excess symbols
    for (const sub of toRemove) {
      if (this.isConnected) {
        this.sendMessage({ type: 'unsubscribe', symbol: sub.symbol });
      }
      this.subscriptions.delete(sub.symbol);
      this.logger.debug(`Removed ${sub.symbol} due to limit`);
    }
    
    // Ensure kept symbols are subscribed
    for (const sub of toKeep) {
      if (this.isConnected && !this.isSubscribedOnServer(sub.symbol)) {
        this.sendMessage({ type: 'subscribe', symbol: sub.symbol });
      }
    }
  }

  /**
   * Check if we can subscribe to a new symbol
   */
  private canSubscribe(symbol: string): boolean {
    const activeSymbols = this.getActiveSymbols();
    return activeSymbols.length < this.MAX_SYMBOLS || activeSymbols.includes(symbol);
  }

  /**
   * Get list of active symbols (top priority)
   */
  private getActiveSymbols(): string[] {
    return Array.from(this.subscriptions.values())
      .sort((a, b) => {
        if (a.priority !== b.priority) {
          return b.priority - a.priority;
        }
        return b.lastAccessed - a.lastAccessed;
      })
      .slice(0, this.MAX_SYMBOLS)
      .map(sub => sub.symbol);
  }

  /**
   * Track if symbol is subscribed on server
   */
  private subscribedOnServer: Set<string> = new Set();
  
  private isSubscribedOnServer(symbol: string): boolean {
    return this.subscribedOnServer.has(symbol);
  }

  /**
   * Send message to WebSocket
   */
  private sendMessage(message: any): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
      
      // Track subscriptions
      if (message.type === 'subscribe') {
        this.subscribedOnServer.add(message.symbol);
      } else if (message.type === 'unsubscribe') {
        this.subscribedOnServer.delete(message.symbol);
      }
    } else {
      this.logger.warn('WebSocket not connected, cannot send message');
    }
  }

  /**
   * Resubscribe to active symbols after reconnection
   */
  private resubscribeActiveSymbols(): void {
    this.subscribedOnServer.clear();
    
    const activeSymbols = this.getActiveSymbols();
    for (const symbol of activeSymbols) {
      this.sendMessage({ type: 'subscribe', symbol });
      this.logger.debug(`Resubscribed to ${symbol}`);
    }
  }

  /**
   * Schedule reconnection attempt
   */
  private scheduleReconnect(): void {
    if (this.reconnectInterval) {
      return;
    }

    this.connectionAttempts++;
    
    if (this.connectionAttempts > this.MAX_RECONNECT_ATTEMPTS) {
      this.logger.error('Max reconnection attempts reached');
      return;
    }
    
    const delay = Math.min(1000 * Math.pow(2, this.connectionAttempts), 30000);
    
    this.reconnectInterval = setTimeout(() => {
      this.logger.log(`Reconnection attempt ${this.connectionAttempts}`);
      this.reconnectInterval = null;
      this.connect();
    }, delay);
  }

  /**
   * Clear reconnection interval
   */
  private clearReconnectInterval(): void {
    if (this.reconnectInterval) {
      clearTimeout(this.reconnectInterval);
      this.reconnectInterval = null;
    }
  }

  /**
   * Get subscription statistics
   */
  getStats(): any {
    const activeSymbols = this.getActiveSymbols();
    
    return {
      connected: this.isConnected,
      totalSubscriptions: this.subscriptions.size,
      activeSymbols: activeSymbols.length,
      maxSymbols: this.MAX_SYMBOLS,
      symbols: activeSymbols,
      connectionAttempts: this.connectionAttempts,
    };
  }

  /**
   * Get symbol priority
   */
  getSymbolPriority(symbol: string): number {
    const subscription = this.subscriptions.get(symbol.toUpperCase());
    return subscription ? subscription.priority : 0;
  }

  /**
   * Update symbol priority
   */
  updateSymbolPriority(symbol: string, priority: number): void {
    const subscription = this.subscriptions.get(symbol.toUpperCase());
    if (subscription) {
      subscription.priority = priority;
      this.manageSymbolLimit();
    }
  }

  /**
   * Disconnect and cleanup
   */
  disconnect(): void {
    this.clearReconnectInterval();

    if (this.ws) {
      // Unsubscribe from all symbols
      for (const symbol of this.subscribedOnServer) {
        this.sendMessage({ type: 'unsubscribe', symbol });
      }
      
      this.ws.close();
      this.ws = null;
    }

    this.subscriptions.clear();
    this.subscribedOnServer.clear();
    this.symbolEmitter.removeAllListeners();
    this.isConnected = false;
  }

  onModuleDestroy(): void {
    this.disconnect();
  }
}