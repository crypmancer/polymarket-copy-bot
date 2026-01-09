/**
 * Polymarket API client for interacting with the CLOB (Central Limit Order Book)
 */
import axios, { AxiosInstance } from 'axios';
import WebSocket from 'ws';
import { ethers } from 'ethers';
import { PolymarketConfig } from './config';
import { OnChainMonitor } from './on-chain-monitor';

export class PolymarketClient {
  private config: PolymarketConfig;
  private clobClient: AxiosInstance;
  private gammaClient: AxiosInstance;
  private dataClient: AxiosInstance;
  private wsUrl: string;
  private ws?: WebSocket;
  private wallet?: ethers.Wallet;
  private onChainMonitor?: OnChainMonitor;

  constructor(config: PolymarketConfig, walletAddresses: string[] = []) {
    this.config = config;
    this.wsUrl = config.wsUrl;

    // Create axios instances for each API
    this.clobClient = axios.create({
      baseURL: config.clobApiUrl,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    this.gammaClient = axios.create({
      baseURL: config.gammaApiUrl,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    this.dataClient = axios.create({
      baseURL: config.dataApiUrl,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    // Add API key to headers if provided
    if (config.apiKey) {
      this.clobClient.defaults.headers.common['Authorization'] = `Bearer ${config.apiKey}`;
      this.gammaClient.defaults.headers.common['Authorization'] = `Bearer ${config.apiKey}`;
      this.dataClient.defaults.headers.common['Authorization'] = `Bearer ${config.apiKey}`;
    }

    // Initialize wallet for signing if private key provided
    if (config.privateKey) {
      try {
        const provider = config.rpcUrl
          ? new ethers.JsonRpcProvider(config.rpcUrl)
          : ethers.getDefaultProvider('polygon');
        this.wallet = new ethers.Wallet(config.privateKey, provider);
        console.log(`Wallet initialized: ${this.wallet.address}`);
      } catch (error) {
        console.error('Error initializing wallet:', error);
      }
    }

    // Initialize on-chain monitor if RPC URL provided
    if (config.rpcUrl && walletAddresses.length > 0) {
      this.onChainMonitor = new OnChainMonitor(config.rpcUrl, walletAddresses);
    }
  }

  async getMarkets(
    active: boolean = true,
    limit: number = 100,
    offset: number = 0
  ): Promise<any[]> {
    try {
      // Use Gamma API for market discovery
      const params = {
        active: active.toString(),
        limit: limit.toString(),
        offset: offset.toString()
      };
      const response = await this.gammaClient.get('/markets', { params });
      return response.data?.data || response.data || [];
    } catch (error: any) {
      console.error('Error fetching markets:', error.message);
      return [];
    }
  }

  async getMarket(marketId: string): Promise<any | null> {
    try {
      // Use Gamma API for market details
      const response = await this.gammaClient.get(`/markets/${marketId}`);
      return response.data?.data || response.data || null;
    } catch (error: any) {
      console.error(`Error fetching market ${marketId}:`, error.message);
      return null;
    }
  }

  async getOrderBook(marketId: string): Promise<any | null> {
    try {
      // Use CLOB API for orderbook (token-based, need to get token IDs first)
      // For now, try the market-based endpoint
      const response = await this.clobClient.get(`/book`, {
        params: { market: marketId }
      });
      if (response.data) {
        // Transform to our expected format
        return this.transformOrderBook(response.data, marketId);
      }
      return null;
    } catch (error: any) {
      console.error(`Error fetching order book for ${marketId}:`, error.message);
      return null;
    }
  }

  private transformOrderBook(bookData: any, marketId: string): any {
    try {
      // Polymarket API returns order book in specific format
      // Adapt this based on actual API response structure
      const transformed: any = {
        marketId,
        outcomes: {}
      };

      // Extract YES and NO outcomes
      for (const outcome of ['YES', 'NO']) {
        const outcomeKey = outcome.toLowerCase();
        if (bookData[outcomeKey]) {
          const outcomeData = bookData[outcomeKey];
          transformed.outcomes[outcome] = {
            asks: outcomeData.asks || [],
            bids: outcomeData.bids || []
          };
        }
      }

      // Add market info if available
      if (bookData.market) {
        transformed.market = bookData.market;
      }

      return transformed;
    } catch (error) {
      console.error('Error transforming order book:', error);
      return { marketId, outcomes: {} };
    }
  }

  /**
   * Get wallet positions (based on vladmeer/polymarket-copy-trading-bot approach)
   * They monitor positions - new positions = new trades
   * This is more reliable than monitoring trade history
   */
  async getWalletPositions(walletAddress: string): Promise<any[]> {
    try {
      // Use Data API /positions endpoint (as used in vladmeer's bot)
      const params: any = {
        user: walletAddress.toLowerCase()
      };
      
      const response = await this.dataClient.get('/positions', { params });
      
      if (response.data?.data && Array.isArray(response.data.data)) {
        return response.data.data;
      }
      if (Array.isArray(response.data)) {
        return response.data;
      }
      
      return [];
    } catch (error: any) {
      // Suppress 400 errors (expected when auth is required)
      if (error.response?.status !== 400) {
        console.debug(`Data API /positions: ${error.message}`);
      }
      return [];
    }
  }

  async getWalletTrades(
    walletAddress: string,
    since?: Date,
    limit: number = 100
  ): Promise<any[]> {
    try {
      // Method 1: Monitor positions (like vladmeer's bot) - PRIMARY METHOD
      // New positions = new trades - this is more reliable
      try {
        const positions = await this.getWalletPositions(walletAddress);
        if (positions.length > 0) {
          // Convert positions to trade format
          // A new position means a buy trade
          return this.transformPositionsToTrades(positions, walletAddress, since);
        }
      } catch (posError: any) {
        if (posError.response?.status !== 400) {
          console.debug(`Position monitoring failed: ${posError.message}`);
        }
      }

      // Method 2: Use on-chain monitoring (fallback)
      if (this.onChainMonitor) {
        const onChainTrades = await this.onChainMonitor.getWalletTrades(
          walletAddress,
          since,
          limit
        );
        if (onChainTrades.length > 0) {
          return this.transformOnChainTrades(onChainTrades);
        }
      }

      // Method 3: Try Data API /activity endpoint
      try {
        const params: any = {
          address: walletAddress.toLowerCase(),
          limit: limit
        };
        if (since) {
          params.from = Math.floor(since.getTime() / 1000);
        }
        
        const response = await this.dataClient.get('/activity', { params });
        if (response.data?.data && Array.isArray(response.data.data) && response.data.data.length > 0) {
          return this.transformApiTrades(response.data.data);
        }
        if (Array.isArray(response.data) && response.data.length > 0) {
          return this.transformApiTrades(response.data);
        }
      } catch (apiError: any) {
        if (apiError.response?.status !== 400) {
          console.debug(`Data API /activity: ${apiError.message}`);
        }
      }

      // Method 4: Try /trades endpoint
      try {
        const params: any = {
          user: walletAddress.toLowerCase(),
          limit: limit
        };
        if (since) {
          params.from = Math.floor(since.getTime() / 1000);
        }
        
        const response = await this.dataClient.get('/trades', { params });
        if (response.data?.data && Array.isArray(response.data.data)) {
          return this.transformApiTrades(response.data.data);
        }
        if (Array.isArray(response.data)) {
          return this.transformApiTrades(response.data);
        }
      } catch (tradesError: any) {
        if (tradesError.response?.status !== 400) {
          console.debug(`Data API /trades: ${tradesError.message}`);
        }
      }

      // No trades found - this is normal if wallet hasn't traded recently
      return [];
    } catch (error: any) {
      console.error(`Error fetching wallet trades for ${walletAddress}:`, error.message);
      return [];
    }
  }

  /**
   * Transform positions to trades format
   * Based on vladmeer's approach: new positions = new trades
   */
  private transformPositionsToTrades(
    positions: any[],
    _walletAddress: string,
    since?: Date
  ): any[] {
    const trades: any[] = [];
    
    for (const position of positions) {
      // Only include positions opened after 'since' timestamp
      if (since) {
        const positionTime = position.createdAt || position.timestamp || position.openedAt;
        if (positionTime) {
          const posDate = new Date(positionTime);
          if (posDate <= since) {
            continue; // Skip old positions
          }
        }
      }

      // Convert position to trade format
      trades.push({
        market: position.market || { id: position.marketId, question: position.question || '' },
        marketId: position.marketId || position.market?.id,
        question: position.question || position.market?.question || '',
        outcome: position.outcome || position.side?.toUpperCase() || 'YES',
        side: 'buy', // New position = buy trade
        price: parseFloat(position.price || position.avgPrice || position.pricePerShare || 0),
        size: parseFloat(position.size || position.amount || position.quantity || 0),
        timestamp: position.createdAt || position.timestamp || position.openedAt || new Date().toISOString(),
        txHash: position.txHash || position.transactionHash,
        // Position-specific data for deduplication
        positionId: position.id || position.positionId,
        balance: position.balance || position.amount
      });
    }

    return trades;
  }

  /**
   * Transform API trade data to expected format
   */
  private transformApiTrades(apiTrades: any[]): any[] {
    return apiTrades.map(trade => ({
      market: trade.market || { id: trade.marketId, question: trade.question || '' },
      marketId: trade.marketId || trade.market?.id,
      question: trade.question || trade.market?.question || '',
      outcome: trade.outcome || trade.side?.toUpperCase(),
      side: trade.side?.toLowerCase() || (trade.type === 'buy' ? 'buy' : 'sell'),
      price: parseFloat(trade.price || trade.pricePerShare || 0),
      size: parseFloat(trade.size || trade.amount || 0),
      timestamp: trade.timestamp || trade.createdAt || trade.time,
      txHash: trade.txHash || trade.transactionHash || trade.hash
    }));
  }

  /**
   * Transform on-chain trade data to expected format
   */
  private transformOnChainTrades(onChainTrades: any[]): any[] {
    // On-chain trades need additional processing to extract market info
    // This is a simplified transformation - may need enhancement based on actual event structure
    return onChainTrades.map(trade => ({
      marketId: trade.rawData?.marketId || 'unknown',
      question: 'On-chain trade',
      outcome: trade.outcome || 'YES',
      side: trade.side || 'buy',
      price: trade.price || 0,
      size: trade.size || 0,
      timestamp: trade.timestamp.toISOString(),
      txHash: trade.txHash
    }));
  }

  async placeOrder(
    marketId: string,
    outcome: string,
    side: string,
    price: number,
    size: number,
    orderType: string = 'LIMIT'
  ): Promise<any | null> {
    try {
      // Construct order payload
      const orderData: any = {
        market: marketId,
        outcome,
        side: side.toUpperCase(),
        price: price.toString(),
        size: size.toString(),
        type: orderType
      };

      // Sign order if private key is available
      if (this.wallet) {
        try {
          // Create EIP-712 typed data for Polymarket order
          const domain = {
            name: 'Polymarket',
            version: '1',
            chainId: this.config.chainId,
            verifyingContract: '0x4D97DCd97eC945f40cF65F87097ACe5EA0476045' // ConditionalTokens contract
          };

          const types = {
            Order: [
              { name: 'market', type: 'string' },
              { name: 'outcome', type: 'string' },
              { name: 'side', type: 'string' },
              { name: 'price', type: 'string' },
              { name: 'size', type: 'string' },
              { name: 'type', type: 'string' },
              { name: 'nonce', type: 'uint256' }
            ]
          };

          // Generate nonce (use timestamp or random)
          const nonce = Date.now();
          const value = {
            ...orderData,
            nonce
          };

          // Sign the typed data
          const signature = await this.wallet.signTypedData(domain, types, value);
          
          // Add signature to order payload
          orderData.signature = signature;
          orderData.signer = this.wallet.address;
          orderData.nonce = nonce.toString();

          console.log(`Order signed by ${this.wallet.address}`);
        } catch (signError: any) {
          console.error('Error signing order:', signError.message);
          // Continue without signature - API might accept unsigned orders for testing
          console.warn('Proceeding with unsigned order (may be rejected by API)');
        }
      } else {
        console.warn('No wallet configured - order will be unsigned');
      }

      // Use CLOB API for placing orders
      const response = await this.clobClient.post('/order', orderData);
      return response.data?.data || response.data || null;
    } catch (error: any) {
      console.error('Error placing order:', error.message);
      if (error.response) {
        console.error('API response:', error.response.data);
      }
      return null;
    }
  }

  async cancelOrder(orderId: string): Promise<boolean> {
    try {
      // Use CLOB API DELETE /order endpoint
      await this.clobClient.delete(`/order`, {
        data: { orderId }
      });
      return true;
    } catch (error: any) {
      console.error(`Error canceling order ${orderId}:`, error.message);
      return false;
    }
  }

  async getBalance(): Promise<number | null> {
    try {
      // Use Data API for balance/positions
      const response = await this.dataClient.get('/positions');
      if (response.data) {
        // Calculate total balance from positions
        const positions = response.data?.data || response.data || [];
        const totalBalance = positions.reduce((sum: number, pos: any) => {
          return sum + (parseFloat(pos.balance || pos.amount || '0'));
        }, 0);
        return totalBalance;
      }
      return null;
    } catch (error: any) {
      console.error('Error getting balance:', error.message);
      return null;
    }
  }

  connectWebSocket(callback: (data: any) => void): void {
    try {
      this.ws = new WebSocket(this.wsUrl);

      this.ws.on('open', () => {
        console.log('Connected to Polymarket websocket');
      });

      this.ws.on('message', (data: WebSocket.Data) => {
        try {
          const message = JSON.parse(data.toString());
          callback(message);
        } catch (error) {
          console.error('Error parsing websocket message:', error);
        }
      });

      this.ws.on('error', (error) => {
        console.error('WebSocket error:', error);
      });

      this.ws.on('close', () => {
        console.log('WebSocket connection closed');
      });
    } catch (error) {
      console.error('Error connecting to websocket:', error);
    }
  }

  closeWebSocket(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = undefined;
    }
  }
}

