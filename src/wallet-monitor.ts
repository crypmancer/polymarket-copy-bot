/**
 * Wallet monitoring module to track target wallets and their trades
 */
import { WalletConfig } from './config';
import { PolymarketClient } from './polymarket-client';

export interface WalletTrade {
  walletAddress: string;
  walletName: string;
  marketId: string;
  marketQuestion: string;
  outcome: 'YES' | 'NO';
  side: 'buy' | 'sell';
  price: number;
  size: number;
  sizeUsd: number;
  timestamp: Date;
  txHash?: string;
}

export type TradeCallback = (trade: WalletTrade) => Promise<void> | void;

export class WalletMonitor {
  private walletConfigs: Map<string, WalletConfig>;
  private pmClient: PolymarketClient;
  private tradeCallback?: TradeCallback;
  private lastTradeTimestamps: Map<string, Date> = new Map();
  private tradeHistory: Map<string, WalletTrade[]> = new Map();
  private lastKnownPositions: Map<string, Set<string>> = new Map(); // Track known position IDs
  private running: boolean = false;
  private checkCount: Map<string, number> = new Map(); // Track check count per wallet

  constructor(
    walletConfigs: WalletConfig[],
    polymarketClient: PolymarketClient,
    tradeCallback?: TradeCallback
  ) {
    this.walletConfigs = new Map(
      walletConfigs.filter(wc => wc.enabled).map(wc => [wc.address, wc])
    );
    this.pmClient = polymarketClient;
    this.tradeCallback = tradeCallback;

    // Initialize trade history for each wallet
    for (const [address] of this.walletConfigs) {
      this.tradeHistory.set(address, []);
    }
  }

  async startMonitoring(checkInterval: number = 1.0): Promise<void> {
    this.running = true;
    console.log(`Starting wallet monitoring for ${this.walletConfigs.size} wallets`);

    while (this.running) {
      try {
        await this.checkAllWallets();
        await this.sleep(checkInterval * 1000);
      } catch (error) {
        console.error('Error in wallet monitoring loop:', error);
        await this.sleep(checkInterval * 1000);
      }
    }
  }

  stopMonitoring(): void {
    this.running = false;
    console.log('Stopped wallet monitoring');
  }

  private async checkAllWallets(): Promise<void> {
    const tasks = Array.from(this.walletConfigs.keys()).map(address =>
      this.checkWallet(address)
    );
    await Promise.allSettled(tasks);
  }

  private async checkWallet(walletAddress: string): Promise<void> {
    try {
      const config = this.walletConfigs.get(walletAddress);
      if (!config) {
        return;
      }

      // Get recent trades for this wallet
      // Method: Check positions (like vladmeer's bot) - new positions = new trades
      const since = this.lastTradeTimestamps.get(walletAddress);
      const trades = await this.pmClient.getWalletTrades(
        walletAddress,
        since
      );
      
      // Debug: Log periodic status (every 60 checks = ~1 minute at 1s interval)
      const checkCount = (this.checkCount.get(walletAddress) || 0) + 1;
      this.checkCount.set(walletAddress, checkCount);
      
      if (checkCount % 60 === 0) {
        const lastCheck = since ? `Last trade: ${since.toISOString()}` : 'No previous trades';
        console.log(
          `[${config.name}] Monitoring active - Check #${checkCount}, ` +
          `${trades.length} new trades found, ${lastCheck}`
        );
      }

      for (const tradeData of trades) {
        const trade = this.parseTrade(tradeData, config);
        if (trade) {
          // Check if this is a new trade (by position ID if available, or by tx hash)
          const positionId = tradeData.positionId;
          if (positionId) {
            const knownPositions = this.lastKnownPositions.get(walletAddress) || new Set();
            if (knownPositions.has(positionId)) {
              continue; // Already seen this position
            }
            knownPositions.add(positionId);
            this.lastKnownPositions.set(walletAddress, knownPositions);
          }
          
          // Also check by standard trade deduplication
          if (this.isNewTrade(trade)) {
            console.log(
              `New trade from ${config.name}: ` +
              `${trade.side} ${trade.sizeUsd.toFixed(2)} USD of ${trade.outcome} ` +
              `@ ${trade.price.toFixed(4)} in ${trade.marketQuestion.substring(0, 50)}`
            );

            // Add to history
            const history = this.tradeHistory.get(walletAddress) || [];
            history.push(trade);
            this.tradeHistory.set(walletAddress, history);

            // Update last timestamp
            this.lastTradeTimestamps.set(walletAddress, trade.timestamp);

            // Call callback if provided
            if (this.tradeCallback) {
              try {
                await this.tradeCallback(trade);
              } catch (error) {
                console.error('Error in trade callback:', error);
              }
            }
          }
        }
      }
    } catch (error) {
      console.error(`Error checking wallet ${walletAddress}:`, error);
    }
  }

  private parseTrade(tradeData: any, config: WalletConfig): WalletTrade | null {
    try {
      // Adapt this based on actual Polymarket API response format
      const marketId = tradeData.market?.id || tradeData.marketId;
      const marketQuestion = tradeData.market?.question || tradeData.question || '';
      const outcome = (tradeData.outcome || '').toUpperCase() as 'YES' | 'NO';
      const side = (tradeData.side || '').toLowerCase() as 'buy' | 'sell';
      const price = parseFloat(tradeData.price || 0);
      const size = parseFloat(tradeData.size || 0);

      // Calculate USD value
      const sizeUsd = size * price;

      // Parse timestamp
      let timestamp: Date;
      const timestampStr = tradeData.timestamp || tradeData.createdAt;
      if (timestampStr) {
        timestamp = new Date(timestampStr);
      } else {
        timestamp = new Date();
      }

      const txHash = tradeData.txHash || tradeData.transactionHash;

      if (!marketId || !['YES', 'NO'].includes(outcome) || !['buy', 'sell'].includes(side) || price <= 0) {
        return null;
      }

      return {
        walletAddress: config.address,
        walletName: config.name,
        marketId,
        marketQuestion,
        outcome,
        side,
        price,
        size,
        sizeUsd,
        timestamp,
        txHash
      };
    } catch (error) {
      console.error('Error parsing trade data:', error);
      return null;
    }
  }

  private isNewTrade(trade: WalletTrade): boolean {
    const walletTrades = this.tradeHistory.get(trade.walletAddress) || [];

    // Check if we've seen this exact trade before (by tx_hash or timestamp+market+outcome)
    for (const existingTrade of walletTrades) {
      if (trade.txHash && existingTrade.txHash === trade.txHash) {
        return false;
      }
      if (
        existingTrade.marketId === trade.marketId &&
        existingTrade.outcome === trade.outcome &&
        existingTrade.side === trade.side &&
        Math.abs(existingTrade.timestamp.getTime() - trade.timestamp.getTime()) < 5000
      ) {
        return false;
      }
    }

    return true;
  }

  getWalletStats(walletAddress: string): any | null {
    if (!this.walletConfigs.has(walletAddress)) {
      return null;
    }

    const trades = this.tradeHistory.get(walletAddress) || [];
    if (trades.length === 0) {
      return { totalTrades: 0 };
    }

    // Calculate basic stats
    const totalTrades = trades.length;
    const totalVolumeUsd = trades.reduce((sum, t) => sum + t.sizeUsd, 0);
    const buyTrades = trades.filter(t => t.side === 'buy');
    const sellTrades = trades.filter(t => t.side === 'sell');

    // Group by market
    const markets: Record<string, { trades: number; volumeUsd: number }> = {};
    for (const trade of trades) {
      if (!markets[trade.marketId]) {
        markets[trade.marketId] = { trades: 0, volumeUsd: 0 };
      }
      markets[trade.marketId].trades += 1;
      markets[trade.marketId].volumeUsd += trade.sizeUsd;
    }

    return {
      totalTrades,
      totalVolumeUsd,
      buyTrades: buyTrades.length,
      sellTrades: sellTrades.length,
      markets,
      lastTrade: trades[trades.length - 1].timestamp.toISOString()
    };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

