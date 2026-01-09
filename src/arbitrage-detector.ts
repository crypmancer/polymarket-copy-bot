/**
 * Arbitrage detection module for Polymarket
 * Detects internal arbitrage (YES+NO < $1) and cross-platform opportunities
 */
import { ArbitrageConfig } from './config';
import { PolymarketClient } from './polymarket-client';

export interface ArbitrageOpportunity {
  marketId: string;
  marketQuestion: string;
  opportunityType: 'internal' | 'cross_platform';
  yesPrice: number;
  noPrice: number;
  totalCost: number;
  profitPct: number;
  profitUsd: number;
  liquidityYes: number;
  liquidityNo: number;
  timestamp: Date;
  expiryTime?: Date;
}

export class ArbitrageDetector {
  private config: ArbitrageConfig;
  private pmClient: PolymarketClient;
  private activeOpportunities: Map<string, ArbitrageOpportunity> = new Map();

  constructor(config: ArbitrageConfig, polymarketClient: PolymarketClient) {
    this.config = config;
    this.pmClient = polymarketClient;
  }

  async scanMarket(marketId: string): Promise<ArbitrageOpportunity | null> {
    try {
      // Get market order book
      const orderBook = await this.pmClient.getOrderBook(marketId);
      if (!orderBook) {
        return null;
      }

      // Check internal arbitrage (YES + NO < $1)
      if (this.config.internalArbEnabled) {
        const opp = this.detectInternalArbitrage(marketId, orderBook);
        if (opp && this.isValid(opp)) {
          return opp;
        }
      }

      // Check cross-platform arbitrage (if enabled)
      if (this.config.crossPlatformEnabled) {
        const opp = await this.detectCrossPlatformArbitrage(marketId, orderBook);
        if (opp && this.isValid(opp)) {
          return opp;
        }
      }
    } catch (error) {
      console.error(`Error scanning market ${marketId}:`, error);
    }

    return null;
  }

  private detectInternalArbitrage(
    marketId: string,
    orderBook: any
  ): ArbitrageOpportunity | null {
    try {
      // Extract best bid/ask for YES and NO tokens
      const yesBestAsk = this.getBestAsk(orderBook, 'YES');
      const noBestAsk = this.getBestAsk(orderBook, 'NO');

      if (!yesBestAsk || !noBestAsk) {
        return null;
      }

      const yesPrice = parseFloat(yesBestAsk.price);
      const noPrice = parseFloat(noBestAsk.price);
      const totalCost = yesPrice + noPrice;

      // Arbitrage exists if total < $1 (accounting for fees)
      // With recent taker fees, need to account for ~0.5-1% fees
      const feeAdjustedCost = totalCost * 1.01; // Assume 1% fees

      if (feeAdjustedCost < 0.99) {
        // Minimum 1% profit after fees
        const profitPct = (1.0 - feeAdjustedCost) / feeAdjustedCost;

        // Calculate available liquidity
        const liquidityYes = (yesBestAsk.size || 0) * yesPrice;
        const liquidityNo = (noBestAsk.size || 0) * noPrice;
        // const minLiquidity = Math.min(liquidityYes, liquidityNo);

        // Calculate profit for $1 investment
        const profitUsd = profitPct * 1.0;

        const marketInfo = orderBook.market || {};

        return {
          marketId,
          marketQuestion: marketInfo.question || marketId,
          opportunityType: 'internal',
          yesPrice,
          noPrice,
          totalCost,
          profitPct,
          profitUsd,
          liquidityYes,
          liquidityNo,
          timestamp: new Date()
        };
      }
    } catch (error) {
      console.error(`Error detecting internal arbitrage for ${marketId}:`, error);
    }

    return null;
  }

  private async detectCrossPlatformArbitrage(
    _marketId: string,
    _orderBook: any
  ): Promise<ArbitrageOpportunity | null> {
    // TODO: Implement cross-platform detection
    // This would require:
    // 1. Kalshi API integration
    // 2. Market matching logic (same event on both platforms)
    // 3. Price comparison and profit calculation

    // For now, return null - can be extended later
    return null;
  }

  private getBestAsk(orderBook: any, outcome: string): any | null {
    try {
      const outcomes = orderBook.outcomes || {};
      const outcomeData = outcomes[outcome] || {};
      const asks = outcomeData.asks || [];

      if (!asks || asks.length === 0) {
        return null;
      }

      // Sort by price (ascending) and get best (lowest) ask
      const sortedAsks = asks.sort((a: any, b: any) => 
        parseFloat(a.price) - parseFloat(b.price)
      );
      return sortedAsks[0] || null;
    } catch (error) {
      console.error(`Error getting best ask for ${outcome}:`, error);
      return null;
    }
  }

  async scanMarkets(marketIds: string[]): Promise<ArbitrageOpportunity[]> {
    const opportunities: ArbitrageOpportunity[] = [];

    // Scan markets concurrently
    const results = await Promise.allSettled(
      marketIds.map(mid => this.scanMarket(mid))
    );

    for (const result of results) {
      if (result.status === 'fulfilled' && result.value) {
        opportunities.push(result.value);
      } else if (result.status === 'rejected') {
        console.error('Error in market scan:', result.reason);
      }
    }

    // Update active opportunities
    for (const opp of opportunities) {
      this.activeOpportunities.set(opp.marketId, opp);
    }

    return opportunities;
  }

  getOpportunity(marketId: string): ArbitrageOpportunity | null {
    return this.activeOpportunities.get(marketId) || null;
  }

  hasOpportunity(marketId: string): boolean {
    const opp = this.activeOpportunities.get(marketId);
    return opp !== undefined && this.isValid(opp);
  }

  private isValid(opp: ArbitrageOpportunity): boolean {
    if (opp.profitPct < this.config.minArbProfitPct) {
      return false;
    }
    if (opp.profitPct > this.config.maxArbProfitPct) {
      return false;
    }
    if (opp.liquidityYes < this.config.minLiquidityUsd) {
      return false;
    }
    if (opp.liquidityNo < this.config.minLiquidityUsd) {
      return false;
    }
    return true;
  }
}

