# Polymarket Arbitrage + Copy Trading Bot

A sophisticated trading bot that combines **arbitrage detection** and **copy trading** strategies on Polymarket. This bot monitors successful wallets (like arbitrage-focused bots) and selectively copies their trades when arbitrage opportunities are detected.

## Features

### 🎯 Dual Strategy Approach
- **Arbitrage Detection**: Automatically detects risk-free arbitrage opportunities (YES + NO < $1)
- **Copy Trading**: Monitors and replicates trades from proven wallets
- **Hybrid Filtering**: Only copies trades when arbitrage signals align

### 🔍 Key Capabilities
- Real-time wallet monitoring for target addresses
- Internal arbitrage detection (YES+NO mispricings)
- Cross-platform arbitrage support (extensible to Kalshi, etc.)
- Risk management with position limits and daily loss controls
- Automatic hedging for unbalanced positions
- Configurable position sizing and filters

### 🛡️ Risk Management
- Total exposure limits
- Per-market position caps
- Daily loss limits
- Minimum liquidity requirements
- Slippage protection

## Architecture

```
src/
├── bot.ts                    # Main orchestrator
├── config.ts                 # Configuration management
├── polymarket-client.ts      # Polymarket API client
├── arbitrage-detector.ts     # Arbitrage opportunity detection
├── wallet-monitor.ts         # Wallet activity monitoring
├── copy-trader.ts           # Copy trading execution engine
├── risk-manager.ts          # Risk limits and position tracking
└── order-executor.ts        # Order placement and management
```

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

Copy `.env.example` to `.env` and fill in your settings:

```bash
cp .env.example .env
```

Key settings:
- `TARGET_WALLET_1`: Wallet address to copy trade (get from Polymarket profile)
- `PRIVATE_KEY`: Your private key for signing orders (required for order execution)
- `POLYGON_RPC_URL`: Polygon RPC endpoint for on-chain monitoring (required)
- `MAX_TOTAL_EXPOSURE_USD`: Maximum total exposure limit
- `MIN_ARB_PROFIT_PCT`: Minimum arbitrage profit % to execute

### 3. Get Wallet Address

To find a wallet address from a Polymarket username:
1. Visit the profile (e.g., `https://polymarket.com/@gabagool22`)
2. Check the profile page or use browser dev tools to find the wallet address
3. Alternatively, use Polymarket Analytics or Dune queries

### 4. Build and Run the Bot

```bash
# Build TypeScript
npm run build

# Run the bot
npm start

# Or run in development mode with auto-reload
npm run dev
```

## Configuration

### Wallet Configuration

Edit `src/config.ts` or use environment variables to configure target wallets:

```typescript
{
  address: "0x...",
  name: "gabagool22",
  enabled: true,
  minWinRate: 0.70,
  maxPositionSizeUsd: 2000.0,
  positionSizeMultiplier: 0.01,  // Copy 1% of wallet's position size
  requireArbSignal: true  // Only copy when arbitrage detected
}
```

### Arbitrage Settings

- `minArbProfitPct`: Minimum profit % to execute (default: 1%)
- `maxArbProfitPct`: Maximum expected profit % (default: 5%)
- `internalArbEnabled`: Enable YES+NO arbitrage detection
- `crossPlatformEnabled`: Enable cross-platform arbitrage (requires additional APIs)

### Risk Limits

- `maxTotalExposureUsd`: Maximum total exposure across all positions
- `maxPositionPerMarketUsd`: Maximum position size per market
- `maxDailyLossUsd`: Daily loss limit before pausing trading
- `enableAutoHedge`: Automatically hedge unbalanced positions

## How It Works

### 1. Wallet Monitoring
The bot continuously monitors configured wallet addresses for new trades via Polymarket's API or on-chain events.

### 2. Arbitrage Detection
Simultaneously scans markets for arbitrage opportunities:
- **Internal Arbitrage**: Detects when YES + NO prices sum to < $1 (risk-free profit)
- **Cross-Platform**: Compares prices across platforms (extensible)

### 3. Copy Trading with Filters
When a monitored wallet makes a trade:
1. Check if wallet meets criteria (win rate, etc.)
2. **If `requireArbSignal=true`**: Verify arbitrage opportunity exists in that market
3. Calculate position size (scaled by multiplier)
4. Check risk limits
5. Execute copy trade (or full arbitrage if internal arb detected)

### 4. Risk Management
- Tracks all positions and exposure
- Enforces limits before opening new positions
- Monitors daily PnL
- Suggests hedging for unbalanced positions

## Strategy Logic

### Pure Arbitrage Mode
When an internal arbitrage opportunity is detected:
- Buy both YES and NO tokens
- Lock in guaranteed profit on market resolution
- Profit = $1 - (YES_price + NO_price) - fees

### Copy Trading Mode
When copying a wallet trade:
- Replicate the trade proportionally
- Only execute if arbitrage signal exists (if enabled)
- Scale position size by configured multiplier

### Hybrid Mode (Recommended)
- Monitor arbitrage-focused wallets
- Copy their trades when arbitrage opportunities align
- Combines reliability of arb with directional upside

## Important Notes

### ⚠️ Current Limitations
- **On-Chain Event Parsing**: May need refinement based on actual Polymarket contract event structure
- **API Response Format**: Order book transformation assumes specific format - may need adjustment
- **Cross-Platform Arb**: Requires external API integrations (Kalshi, etc.) - not critical for basic functionality

### 🔧 Implementation Notes
- The bot is designed to be extensible - add your own API integrations
- WebSocket support is included for real-time updates
- All components are async/await for high performance
- TypeScript provides type safety and better IDE support

### 💰 Fee Considerations
Polymarket introduced taker fees on short-term markets (15-min crypto markets):
- Fees are higher on ~50/50 priced trades
- Lower fees near 10¢/90¢ extremes
- Market makers receive rebates
- Account for fees in arbitrage calculations (currently assumes ~1%)

### 🚨 Risk Warnings
- **Not Financial Advice**: This is experimental software
- **Test Thoroughly**: Start with small positions
- **Slippage**: Fast execution is critical for small edges
- **Competition**: Many bots compete for the same opportunities
- **Platform Changes**: Polymarket may change fees/rules

## Extending the Bot

### Add Cross-Platform Arbitrage
1. Integrate Kalshi API (or other platform) in `arbitrage-detector.ts`
2. Implement market matching logic
3. Add price comparison and profit calculation

### Improve Wallet Monitoring
1. Implement on-chain event parsing (ethers.js or web3.js)
2. Use Polymarket's activity API if available
3. Add websocket subscriptions for real-time updates

### Add More Filters
- Win rate tracking per wallet
- Market category filters
- Time-based filters (e.g., only trade during certain hours)
- Volume-based filters

## Logging

Logs are written to:
- Console (using console.log/error/warn)
- Can be extended with Winston or other logging libraries

## License

This is experimental software. Use at your own risk.

## Contributing

This is a starting point. Key areas for improvement:
1. Complete API integrations (wallet monitoring, order signing)
2. Add cross-platform arbitrage detection
3. Implement advanced risk metrics
4. Add backtesting capabilities
5. Performance optimizations

