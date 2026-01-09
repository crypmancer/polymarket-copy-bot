/**
 * Risk management module to enforce position limits and risk controls
 */
import { RiskConfig } from './config';

export interface Position {
  marketId: string;
  outcome: 'YES' | 'NO';
  side: 'buy' | 'sell';
  sizeUsd: number;
  entryPrice: number;
  timestamp: Date;
}

export interface ExposureMetrics {
  totalExposureUsd: number;
  dailyPnlUsd: number;
  openPositions: number;
  marketExposures: Record<string, number>;
  availableExposure: number;
}

export class RiskManager {
  private config: RiskConfig;
  private positions: Map<string, Position[]> = new Map(); // market_id -> positions
  private totalExposure: number = 0.0;
  private dailyPnl: number = 0.0;
  private lastResetDate: Date = new Date();

  constructor(config: RiskConfig) {
    this.config = config;
    this.lastResetDate = new Date();
  }

  canOpenPosition(
    marketId: string,
    sizeUsd: number
  ): boolean {
    try {
      // Check daily loss limit
      if (this.dailyPnl <= -this.config.maxDailyLossUsd) {
        console.warn(
          `Cannot open position - daily loss limit reached: ${this.dailyPnl.toFixed(2)}`
        );
        return false;
      }

      // Check total exposure limit
      const newTotalExposure = this.totalExposure + sizeUsd;
      if (newTotalExposure > this.config.maxTotalExposureUsd) {
        console.warn(
          `Cannot open position - total exposure limit would be exceeded: ` +
          `${newTotalExposure.toFixed(2)} > ${this.config.maxTotalExposureUsd.toFixed(2)}`
        );
        return false;
      }

      // Check per-market position limit
      const marketPositions = this.positions.get(marketId) || [];
      const marketExposure = marketPositions.reduce((sum, p) => sum + p.sizeUsd, 0);
      const newMarketExposure = marketExposure + sizeUsd;

      if (newMarketExposure > this.config.maxPositionPerMarketUsd) {
        console.warn(
          `Cannot open position - market exposure limit would be exceeded: ` +
          `${newMarketExposure.toFixed(2)} > ${this.config.maxPositionPerMarketUsd.toFixed(2)}`
        );
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error checking if position can be opened:', error);
      return false;
    }
  }

  recordPosition(
    marketId: string,
    sizeUsd: number,
    outcome: 'YES' | 'NO',
    side: 'buy' | 'sell',
    entryPrice?: number
  ): void {
    try {
      if (!this.positions.has(marketId)) {
        this.positions.set(marketId, []);
      }

      const position: Position = {
        marketId,
        outcome,
        side,
        sizeUsd,
        entryPrice: entryPrice || 0.0,
        timestamp: new Date()
      };

      const positions = this.positions.get(marketId)!;
      positions.push(position);
      this.totalExposure += sizeUsd;

      console.debug(
        `Recorded position: ${sizeUsd.toFixed(2)} USD ${side} ${outcome} ` +
        `in market ${marketId}. Total exposure: ${this.totalExposure.toFixed(2)}`
      );
    } catch (error) {
      console.error('Error recording position:', error);
    }
  }

  closePosition(
    marketId: string,
    outcome: 'YES' | 'NO',
    exitPrice?: number
  ): number | null {
    try {
      const positions = this.positions.get(marketId);
      if (!positions || positions.length === 0) {
        return null;
      }

      // Find matching position
      const matchingPositions = positions.filter(
        p => p.outcome === outcome && p.side === 'buy'
      );

      if (matchingPositions.length === 0) {
        return null;
      }

      // Close first matching position (FIFO)
      const position = matchingPositions[0];
      const index = positions.indexOf(position);
      positions.splice(index, 1);

      // Calculate PnL
      let pnl = 0.0;
      if (exitPrice && position.entryPrice > 0) {
        // For YES/NO markets, PnL depends on resolution
        // If YES wins, YES tokens worth $1, NO worth $0
        // If NO wins, YES tokens worth $0, NO worth $1
        // For now, we'll track realized PnL when position is closed
        // This is simplified - actual PnL depends on market resolution
        pnl = (exitPrice - position.entryPrice) * position.sizeUsd / position.entryPrice;
      }

      this.totalExposure -= position.sizeUsd;
      this.dailyPnl += pnl;

      console.log(
        `Closed position: ${position.sizeUsd.toFixed(2)} USD ${position.outcome} ` +
        `in market ${marketId}. PnL: ${pnl.toFixed(2)}. Daily PnL: ${this.dailyPnl.toFixed(2)}`
      );

      return pnl;
    } catch (error) {
      console.error('Error closing position:', error);
      return null;
    }
  }

  getExposure(): ExposureMetrics {
    // Reset daily PnL if new day
    const currentDate = new Date();
    if (currentDate.getDate() !== this.lastResetDate.getDate()) {
      this.dailyPnl = 0.0;
      this.lastResetDate = currentDate;
    }

    const marketExposures: Record<string, number> = {};
    for (const [marketId, positions] of this.positions.entries()) {
      marketExposures[marketId] = positions.reduce((sum, p) => sum + p.sizeUsd, 0);
    }

    return {
      totalExposureUsd: this.totalExposure,
      dailyPnlUsd: this.dailyPnl,
      openPositions: Array.from(this.positions.values()).reduce((sum, p) => sum + p.length, 0),
      marketExposures,
      availableExposure: this.config.maxTotalExposureUsd - this.totalExposure
    };
  }

  shouldHedge(marketId: string): boolean {
    if (!this.config.enableAutoHedge) {
      return false;
    }

    const positions = this.positions.get(marketId) || [];
    if (positions.length < 2) {
      return false;
    }

    // Check if we have unbalanced exposure
    const yesPositions = positions.filter(p => p.outcome === 'YES');
    const noPositions = positions.filter(p => p.outcome === 'NO');

    const yesExposure = yesPositions.reduce((sum, p) => sum + p.sizeUsd, 0);
    const noExposure = noPositions.reduce((sum, p) => sum + p.sizeUsd, 0);

    // If exposure is significantly unbalanced, consider hedging
    const totalExposure = yesExposure + noExposure;
    if (totalExposure === 0) {
      return false;
    }
    const imbalance = Math.abs(yesExposure - noExposure) / totalExposure;
    return imbalance > 0.2; // More than 20% imbalance
  }
}

