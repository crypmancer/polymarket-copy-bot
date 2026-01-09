/**
 * Configuration settings for the Polymarket arbitrage + copy trading bot
 */
import * as dotenv from 'dotenv';

dotenv.config();

export interface WalletConfig {
  address: string;
  name: string;
  enabled: boolean;
  minWinRate: number; // 0.0 to 1.0
  maxPositionSizeUsd: number;
  positionSizeMultiplier: number; // 0.0 to 1.0
  marketsFilter?: string[]; // Specific markets to copy (undefined = all)
  requireArbSignal: boolean; // Only copy if arbitrage signal detected
}

export interface ArbitrageConfig {
  minArbProfitPct: number; // Minimum profit % to execute
  maxArbProfitPct: number; // Maximum expected profit %
  internalArbEnabled: boolean; // YES+NO < $1 arbitrage
  crossPlatformEnabled: boolean; // Cross-platform with Kalshi
  minLiquidityUsd: number; // Minimum liquidity required
  maxSlippagePct: number; // Maximum acceptable slippage
}

export interface RiskConfig {
  maxTotalExposureUsd: number;
  maxPositionPerMarketUsd: number;
  maxDailyLossUsd: number;
  enableAutoHedge: boolean; // Automatically hedge directional arb plays
  minBalanceUsd: number; // Minimum balance to keep
}

export interface PolymarketConfig {
  clobApiUrl: string; // CLOB API for orders and orderbooks
  gammaApiUrl: string; // Gamma API for market discovery
  dataApiUrl: string; // Data API for user activity and positions
  wsUrl: string; // WebSocket URL for real-time updates
  privateKey?: string; // Private key for signing orders
  apiKey?: string; // API key if required
  chainId: number; // Polygon chain ID
  rpcUrl?: string; // Polygon RPC endpoint for on-chain queries
}

export interface BotConfig {
  wallets: WalletConfig[];
  arbitrage: ArbitrageConfig;
  risk: RiskConfig;
  polymarket: PolymarketConfig;
  enabledMarkets?: string[]; // undefined = all markets
  minMarketVolume24h: number;
  maxConcurrentPositions: number;
  walletCheckIntervalSeconds: number;
  arbScanIntervalSeconds: number;
  logLevel: string;
}

export function loadConfig(): BotConfig {
  // Example wallet configs - user should update these
  const wallets: WalletConfig[] = [];
  
  const targetWallet1 = process.env.TARGET_WALLET_1;
  if (targetWallet1) {
    wallets.push({
      address: targetWallet1,
      name: 'gabagool22',
      enabled: true,
      minWinRate: 0.70,
      maxPositionSizeUsd: 2000.0,
      positionSizeMultiplier: 0.01,
      requireArbSignal: true
    });
  }

  const config: BotConfig = {
    wallets,
    arbitrage: {
      minArbProfitPct: parseFloat(process.env.MIN_ARB_PROFIT_PCT || '0.01'),
      maxArbProfitPct: parseFloat(process.env.MAX_ARB_PROFIT_PCT || '0.05'),
      // Default to true if not specified (arbitrage is a core feature)
      internalArbEnabled: process.env.INTERNAL_ARB_ENABLED 
        ? process.env.INTERNAL_ARB_ENABLED.toLowerCase() === 'true'
        : true,
      crossPlatformEnabled: process.env.CROSS_PLATFORM_ENABLED?.toLowerCase() === 'true',
      minLiquidityUsd: 1000.0,
      maxSlippagePct: 0.02
    },
    risk: {
      maxTotalExposureUsd: parseFloat(process.env.MAX_TOTAL_EXPOSURE_USD || '10000.0'),
      maxPositionPerMarketUsd: parseFloat(process.env.MAX_POSITION_PER_MARKET_USD || '2000.0'),
      maxDailyLossUsd: parseFloat(process.env.MAX_DAILY_LOSS_USD || '500.0'),
      enableAutoHedge: true,
      minBalanceUsd: 100.0
    },
    polymarket: {
      clobApiUrl: 'https://clob.polymarket.com',
      gammaApiUrl: 'https://gamma-api.polymarket.com',
      dataApiUrl: 'https://data-api.polymarket.com',
      wsUrl: 'wss://ws-subscriptions-clob.polymarket.com/ws/',
      privateKey: process.env.PRIVATE_KEY,
      apiKey: process.env.API_KEY,
      chainId: 137,
      rpcUrl: process.env.POLYGON_RPC_URL || 'https://polygon-rpc.com'
    },
    minMarketVolume24h: 5000.0,
    maxConcurrentPositions: 10,
    walletCheckIntervalSeconds: 1.0,
    arbScanIntervalSeconds: 0.5,
    logLevel: process.env.LOG_LEVEL || 'INFO'
  };

  return config;
}

