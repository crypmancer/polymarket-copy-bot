/**
 * Main bot orchestrator that combines arbitrage detection and copy trading
 */
import { loadConfig, BotConfig } from './config';
import { PolymarketClient } from './polymarket-client';
import { ArbitrageDetector } from './arbitrage-detector';
import { WalletMonitor, WalletTrade } from './wallet-monitor';
import { CopyTrader } from './copy-trader';
import { RiskManager } from './risk-manager';
import { OrderExecutor } from './order-executor';

export class PolymarketArbCopyBot {
  private config: BotConfig;
  private pmClient?: PolymarketClient;
  private arbDetector?: ArbitrageDetector;
  private walletMonitor?: WalletMonitor;
  private copyTraders: Map<string, CopyTrader> = new Map();
  private riskManager?: RiskManager;
  private orderExecutor?: OrderExecutor;
  private running: boolean = false;

  constructor(config: BotConfig) {
    this.config = config;
  }

  async initialize(): Promise<void> {
    try {
      console.log('Initializing Polymarket Arbitrage + Copy Trading Bot...');

      // Get wallet addresses for on-chain monitoring
      const walletAddresses = this.config.wallets
        .filter(w => w.enabled)
        .map(w => w.address);

      // Initialize Polymarket client
      this.pmClient = new PolymarketClient(this.config.polymarket, walletAddresses);

      // Initialize risk manager
      this.riskManager = new RiskManager(this.config.risk);

      // Initialize order executor
      this.orderExecutor = new OrderExecutor(this.pmClient);

      // Initialize arbitrage detector
      this.arbDetector = new ArbitrageDetector(
        this.config.arbitrage,
        this.pmClient
      );

      // Initialize copy traders for each wallet
      for (const walletConfig of this.config.wallets) {
        const copyTrader = new CopyTrader(
          this.arbDetector!,
          this.riskManager!,
          this.orderExecutor!,
          walletConfig
        );
        this.copyTraders.set(walletConfig.address, copyTrader);
      }

      // Initialize wallet monitor with trade callback
      this.walletMonitor = new WalletMonitor(
        this.config.wallets,
        this.pmClient,
        (trade: WalletTrade) => this.handleWalletTrade(trade)
      );

      console.log('Bot initialization complete');
    } catch (error) {
      console.error('Error initializing bot:', error);
      throw error;
    }
  }

  private async handleWalletTrade(trade: WalletTrade): Promise<void> {
    try {
      // Get copy trader for this wallet
      const copyTrader = this.copyTraders.get(trade.walletAddress);
      if (!copyTrader) {
        console.warn(`No copy trader configured for wallet ${trade.walletAddress}`);
        return;
      }

      // Process the trade
      await copyTrader.processTrade(trade);
    } catch (error) {
      console.error('Error handling wallet trade:', error);
    }
  }

  async start(): Promise<void> {
    try {
      await this.initialize();
      this.running = true;

      console.log('Starting bot...');
      console.log(`Monitoring ${this.config.wallets.length} wallets`);
      console.log(
        `Arbitrage detection: ${this.config.arbitrage.internalArbEnabled ? 'enabled' : 'disabled'}`
      );

      // Start wallet monitoring
      const walletMonitorPromise = this.walletMonitor!.startMonitoring(
        this.config.walletCheckIntervalSeconds
      );

      // Start arbitrage scanning
      const arbScanPromise = this.arbitrageScanLoop();

      // Start status reporting
      const statusPromise = this.statusReportLoop();

      // Wait for all tasks
      await Promise.allSettled([
        walletMonitorPromise,
        arbScanPromise,
        statusPromise
      ]);
    } catch (error) {
      console.error('Error in bot main loop:', error);
      await this.stop();
    }
  }

  private async arbitrageScanLoop(): Promise<void> {
    console.log('Starting arbitrage scanning loop...');

    while (this.running) {
      try {
        // Get active markets
        const markets = await this.pmClient!.getMarkets(true, 100);

        // Filter markets by criteria
        const filteredMarkets = this.filterMarkets(markets);

        if (filteredMarkets.length > 0) {
          const marketIds = filteredMarkets
            .map(m => m.id || m.marketId)
            .filter((id): id is string => !!id);

          // Scan for arbitrage
          const opportunities = await this.arbDetector!.scanMarkets(marketIds);

          if (opportunities.length > 0) {
            console.log(`Found ${opportunities.length} arbitrage opportunities`);
            for (const opp of opportunities) {
              console.log(
                `  - ${opp.marketQuestion.substring(0, 50)}: ` +
                `${(opp.profitPct * 100).toFixed(2)}% profit (${opp.opportunityType})`
              );
            }
          }
        }

        await this.sleep(this.config.arbScanIntervalSeconds * 1000);
      } catch (error) {
        console.error('Error in arbitrage scan loop:', error);
        await this.sleep(this.config.arbScanIntervalSeconds * 1000);
      }
    }
  }

  private filterMarkets(markets: any[]): any[] {
    const filtered: any[] = [];

    for (const market of markets) {
      // Check if market is in enabled list
      const marketId = market.id || market.marketId;
      if (this.config.enabledMarkets && !this.config.enabledMarkets.includes(marketId)) {
        continue;
      }

      // Check volume
      const volume24h = market.volume24h || market.volume_24h || 0;
      if (volume24h < this.config.minMarketVolume24h) {
        continue;
      }

      filtered.push(market);
    }

    return filtered;
  }

  private async statusReportLoop(): Promise<void> {
    console.log('Starting status reporting loop...');

    while (this.running) {
      try {
        await this.sleep(60000); // Report every minute

        // Get risk metrics
        const exposure = this.riskManager!.getExposure();

        // Get active orders
        const activeOrders = this.orderExecutor!.getActiveOrders();

        // Get wallet stats
        const walletStats: Record<string, any> = {};
        for (const walletConfig of this.config.wallets) {
          const stats = this.walletMonitor!.getWalletStats(walletConfig.address);
          if (stats) {
            walletStats[walletConfig.name] = stats;
          }
        }

        console.log('=== Bot Status ===');
        console.log(`Total Exposure: $${exposure.totalExposureUsd.toFixed(2)}`);
        console.log(`Daily PnL: $${exposure.dailyPnlUsd.toFixed(2)}`);
        console.log(`Open Positions: ${exposure.openPositions}`);
        console.log(`Active Orders: ${activeOrders.size}`);
        console.log(`Available Exposure: $${exposure.availableExposure.toFixed(2)}`);

        if (Object.keys(walletStats).length > 0) {
          console.log('Wallet Stats:');
          for (const [name, stats] of Object.entries(walletStats)) {
            console.log(
              `  ${name}: ${stats.totalTrades || 0} trades, ` +
              `$${(stats.totalVolumeUsd || 0).toFixed(2)} volume`
            );
          }
        }
      } catch (error) {
        console.error('Error in status report loop:', error);
      }
    }
  }

  async stop(): Promise<void> {
    console.log('Stopping bot...');
    this.running = false;

    if (this.walletMonitor) {
      this.walletMonitor.stopMonitoring();
    }

    if (this.pmClient) {
      this.pmClient.closeWebSocket();
    }

    console.log('Bot stopped');
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

async function main(): Promise<void> {
  try {
    // Load configuration
    const config = loadConfig();

    // Validate configuration
    if (config.wallets.length === 0) {
      console.error('No wallets configured! Please set TARGET_WALLET_1 in .env file');
      process.exit(1);
    }

    // Create and start bot
    const bot = new PolymarketArbCopyBot(config);

    // Handle graceful shutdown
    process.on('SIGINT', async () => {
      console.log('\nReceived shutdown signal');
      await bot.stop();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      console.log('\nReceived termination signal');
      await bot.stop();
      process.exit(0);
    });

    await bot.start();
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
}

