/**
 * Copy trading engine that replicates trades from monitored wallets
 * with arbitrage filtering
 */
import { WalletConfig } from './config';
import { WalletTrade } from './wallet-monitor';
import { ArbitrageDetector } from './arbitrage-detector';
import { RiskManager } from './risk-manager';
import { OrderExecutor } from './order-executor';

export class CopyTrader {
  private arbDetector: ArbitrageDetector;
  private riskManager: RiskManager;
  private orderExecutor: OrderExecutor;
  private config: WalletConfig;
  private copiedTrades: Map<string, Date> = new Map(); // Track copied trades to avoid duplicates

  constructor(
    arbitrageDetector: ArbitrageDetector,
    riskManager: RiskManager,
    orderExecutor: OrderExecutor,
    config: WalletConfig
  ) {
    this.arbDetector = arbitrageDetector;
    this.riskManager = riskManager;
    this.orderExecutor = orderExecutor;
    this.config = config;
  }

  async processTrade(trade: WalletTrade): Promise<boolean> {
    /**
     * Process a trade from monitored wallet and decide whether to copy it
     * Returns true if trade was copied, false otherwise
     */
    try {
      // Skip if we've already copied this trade
      const tradeKey = `${trade.txHash}_${trade.marketId}_${trade.outcome}_${trade.side}`;
      if (this.copiedTrades.has(tradeKey)) {
        console.debug(`Skipping already copied trade: ${tradeKey}`);
        return false;
      }

      // Check if wallet meets minimum requirements
      if (!this.shouldCopyWallet(trade)) {
        console.debug(`Skipping trade from ${trade.walletName} - doesn't meet criteria`);
        return false;
      }

      // Check market filter
      if (this.config.marketsFilter && !this.config.marketsFilter.includes(trade.marketId)) {
        console.debug(`Skipping trade - market ${trade.marketId} not in filter`);
        return false;
      }

      // Check arbitrage signal if required
      if (this.config.requireArbSignal) {
        const hasArb = this.arbDetector.hasOpportunity(trade.marketId);
        if (!hasArb) {
          console.debug(
            `Skipping trade - no arbitrage signal for market ${trade.marketId}`
          );
          return false;
        }

        // Get arbitrage opportunity details
        const arbOpp = this.arbDetector.getOpportunity(trade.marketId);
        if (arbOpp) {
          console.log(
            `Arbitrage opportunity detected: ${(arbOpp.profitPct * 100).toFixed(2)}% profit ` +
            `for market ${arbOpp.marketQuestion.substring(0, 50)}`
          );
        }
      }

      // Calculate position size
      const positionSizeUsd = this.calculatePositionSize(trade);
      if (positionSizeUsd <= 0) {
        console.debug(`Skipping trade - position size too small: ${positionSizeUsd}`);
        return false;
      }

      // Check risk limits
      if (!this.riskManager.canOpenPosition(
        trade.marketId,
        positionSizeUsd
      )) {
        console.warn(
          `Cannot copy trade - risk limits exceeded for market ${trade.marketId}`
        );
        return false;
      }

      // Execute the copy trade
      const success = await this.executeCopyTrade(trade, positionSizeUsd);

      if (success) {
        this.copiedTrades.set(tradeKey, new Date());
        console.log(
          `Successfully copied trade from ${trade.walletName}: ` +
          `${trade.side} ${positionSizeUsd.toFixed(2)} USD of ${trade.outcome} @ ${trade.price.toFixed(4)}`
        );
        return true;
      } else {
        console.error(`Failed to execute copy trade from ${trade.walletName}`);
        return false;
      }
    } catch (error) {
      console.error(`Error processing trade from ${trade.walletName}:`, error);
      return false;
    }
  }

  private shouldCopyWallet(_trade: WalletTrade): boolean {
    // This could be extended with win rate checks, performance metrics, etc.
    // For now, just check if wallet is enabled
    return this.config.enabled;
  }

  private calculatePositionSize(trade: WalletTrade): number {
    // Use wallet's position size as base, scaled by multiplier
    const baseSize = trade.sizeUsd;

    // Apply position size multiplier
    const scaledSize = baseSize * this.config.positionSizeMultiplier;

    // Cap at max position size
    const finalSize = Math.min(scaledSize, this.config.maxPositionSizeUsd);

    // Ensure minimum viable size (e.g., $10)
    if (finalSize < 10.0) {
      return 0.0;
    }

    return finalSize;
  }

  private async executeCopyTrade(
    trade: WalletTrade,
    positionSizeUsd: number
  ): Promise<boolean> {
    try {
      // Calculate number of shares to buy
      const shares = positionSizeUsd / trade.price;

      // If this is an arbitrage opportunity, we might want to buy both sides
      if (this.config.requireArbSignal) {
        const arbOpp = this.arbDetector.getOpportunity(trade.marketId);
        if (arbOpp && arbOpp.opportunityType === 'internal') {
          // For internal arbitrage, buy both YES and NO
          return await this.executeArbitrageTrade(arbOpp, positionSizeUsd);
        }
      }

      // Regular directional copy trade
      const orderResult = await this.orderExecutor.placeOrder(
        trade.marketId,
        trade.outcome,
        trade.side,
        trade.price,
        shares
      );

      if (orderResult) {
        // Update risk manager
        this.riskManager.recordPosition(
          trade.marketId,
          positionSizeUsd,
          trade.outcome,
          trade.side
        );
        return true;
      }

      return false;
    } catch (error) {
      console.error('Error executing copy trade:', error);
      return false;
    }
  }

  private async executeArbitrageTrade(
    arbOpp: any,
    positionSizeUsd: number
  ): Promise<boolean> {
    try {
      // Split position between YES and NO
      const yesSizeUsd = positionSizeUsd * 0.5;
      const noSizeUsd = positionSizeUsd * 0.5;

      // Calculate shares
      const yesShares = yesSizeUsd / arbOpp.yesPrice;
      const noShares = noSizeUsd / arbOpp.noPrice;

      // Place both orders
      const yesOrder = await this.orderExecutor.placeOrder(
        arbOpp.marketId,
        'YES',
        'buy',
        arbOpp.yesPrice,
        yesShares
      );

      const noOrder = await this.orderExecutor.placeOrder(
        arbOpp.marketId,
        'NO',
        'buy',
        arbOpp.noPrice,
        noShares
      );

      if (yesOrder && noOrder) {
        // Update risk manager for both positions
        this.riskManager.recordPosition(
          arbOpp.marketId,
          yesSizeUsd,
          'YES',
          'buy'
        );
        this.riskManager.recordPosition(
          arbOpp.marketId,
          noSizeUsd,
          'NO',
          'buy'
        );
        console.log(
          `Executed arbitrage trade: ${yesSizeUsd.toFixed(2)} YES + ${noSizeUsd.toFixed(2)} NO ` +
          `for ${(arbOpp.profitPct * 100).toFixed(2)}% profit`
        );
        return true;
      } else {
        // If one order failed, cancel the other
        if (yesOrder) {
          await this.orderExecutor.cancelOrder(yesOrder.orderId);
        }
        if (noOrder) {
          await this.orderExecutor.cancelOrder(noOrder.orderId);
        }
        return false;
      }
    } catch (error) {
      console.error('Error executing arbitrage trade:', error);
      return false;
    }
  }
}

