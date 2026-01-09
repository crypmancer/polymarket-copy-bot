/**
 * Example usage of the Polymarket Arbitrage + Copy Trading Bot
 *
 * This shows how to configure and run the bot programmatically
 */
import { BotConfig, WalletConfig, ArbitrageConfig, RiskConfig, PolymarketConfig } from './config';
import { PolymarketArbCopyBot } from './bot';

async function exampleBasicUsage(): Promise<void> {
  // Create configuration
  const config: BotConfig = {
    wallets: [
      {
        address: '0x1234567890123456789012345678901234567890', // Replace with actual address
        name: 'gabagool22',
        enabled: true,
        minWinRate: 0.70,
        maxPositionSizeUsd: 2000.0,
        positionSizeMultiplier: 0.01, // Copy 1% of wallet's position
        requireArbSignal: true // Only copy when arbitrage detected
      }
    ],
    arbitrage: {
      minArbProfitPct: 0.01, // 1% minimum profit
      maxArbProfitPct: 0.05, // 5% maximum expected
      internalArbEnabled: true,
      crossPlatformEnabled: false, // Disable if no cross-platform API
      minLiquidityUsd: 1000.0,
      maxSlippagePct: 0.02
    },
    risk: {
      maxTotalExposureUsd: 10000.0,
      maxPositionPerMarketUsd: 2000.0,
      maxDailyLossUsd: 500.0,
      enableAutoHedge: true,
      minBalanceUsd: 100.0
    },
    polymarket: {
      apiBaseUrl: 'https://clob.polymarket.com',
      wsUrl: 'wss://clob.polymarket.com',
      privateKey: 'your_private_key_here', // Replace with actual key
      apiKey: undefined // Optional
    },
    minMarketVolume24h: 5000.0,
    maxConcurrentPositions: 10,
    walletCheckIntervalSeconds: 1.0,
    arbScanIntervalSeconds: 0.5,
    logLevel: 'INFO'
  };

  // Create and run bot
  const bot = new PolymarketArbCopyBot(config);
  await bot.start();
}

async function exampleMultipleWallets(): Promise<void> {
  const config: BotConfig = {
    wallets: [
      {
        address: '0x...', // Wallet 1
        name: 'arb_bot_1',
        enabled: true,
        minWinRate: 0.70,
        maxPositionSizeUsd: 2000.0,
        positionSizeMultiplier: 0.01,
        requireArbSignal: true
      },
      {
        address: '0x...', // Wallet 2
        name: 'arb_bot_2',
        enabled: true,
        minWinRate: 0.70,
        maxPositionSizeUsd: 2000.0,
        positionSizeMultiplier: 0.01,
        requireArbSignal: true
      }
    ],
    // ... rest of config
    arbitrage: {
      minArbProfitPct: 0.01,
      maxArbProfitPct: 0.05,
      internalArbEnabled: true,
      crossPlatformEnabled: false,
      minLiquidityUsd: 1000.0,
      maxSlippagePct: 0.02
    },
    risk: {
      maxTotalExposureUsd: 10000.0,
      maxPositionPerMarketUsd: 2000.0,
      maxDailyLossUsd: 500.0,
      enableAutoHedge: true,
      minBalanceUsd: 100.0
    },
    polymarket: {
      apiBaseUrl: 'https://clob.polymarket.com',
      wsUrl: 'wss://clob.polymarket.com',
      chainId: 137
    },
    minMarketVolume24h: 5000.0,
    maxConcurrentPositions: 10,
    walletCheckIntervalSeconds: 1.0,
    arbScanIntervalSeconds: 0.5,
    logLevel: 'INFO'
  };

  const bot = new PolymarketArbCopyBot(config);
  await bot.start();
}

async function examplePureArbitrage(): Promise<void> {
  const config: BotConfig = {
    wallets: [], // No wallets to copy
    arbitrage: {
      minArbProfitPct: 0.005, // Lower threshold for pure arb
      maxArbProfitPct: 0.05,
      internalArbEnabled: true,
      crossPlatformEnabled: false,
      minLiquidityUsd: 1000.0,
      maxSlippagePct: 0.02
    },
    risk: {
      maxTotalExposureUsd: 10000.0,
      maxPositionPerMarketUsd: 2000.0,
      maxDailyLossUsd: 500.0,
      enableAutoHedge: true,
      minBalanceUsd: 100.0
    },
    polymarket: {
      apiBaseUrl: 'https://clob.polymarket.com',
      wsUrl: 'wss://clob.polymarket.com',
      chainId: 137
    },
    minMarketVolume24h: 5000.0,
    maxConcurrentPositions: 10,
    walletCheckIntervalSeconds: 1.0,
    arbScanIntervalSeconds: 0.5,
    logLevel: 'INFO'
  };

  const bot = new PolymarketArbCopyBot(config);
  await bot.start();
}

// Run basic example
if (require.main === module) {
  exampleBasicUsage().catch(error => {
    console.error('Error:', error);
    process.exit(1);
  });
}

