# Polymarket Arbitrage + Copy Trading Bot

<div align="center">

![Rust](https://img.shields.io/badge/rust-%23000000.svg?style=for-the-badge&logo=rust&logoColor=white)
![TypeScript](https://img.shields.io/badge/typescript-%23007ACC.svg?style=for-the-badge&logo=typescript&logoColor=white)
![Polygon](https://img.shields.io/badge/polygon-8247E5?style=for-the-badge&logo=polygon&logoColor=white)
![License](https://img.shields.io/badge/license-MIT-blue.svg?style=for-the-badge)

**A sophisticated trading bot written in Rust that combines arbitrage detection and copy trading strategies on Polymarket**

[Features](#features) • [Quick Start](#setup) • [Documentation](#architecture) • [Contributing](#contributing)

[![GitHub stars](https://img.shields.io/github/stars/crypmancer/polymarket-arbitrage-copy-bot?style=social)](https://github.com/crypmancer/polymarket-arbitrage-copy-bot/stargazers)
[![GitHub forks](https://img.shields.io/github/forks/crypmancer/polymarket-arbitrage-copy-bot?style=social)](https://github.com/crypmancer/polymarket-arbitrage-copy-bot/network/members)

</div>

---

A sophisticated **trading bot** written in **Rust** that combines **arbitrage detection** and **copy trading** strategies on **Polymarket**. This bot monitors successful wallets (like arbitrage-focused bots) and selectively copies their trades when arbitrage opportunities are detected.

**Keywords**: `polymarket` `arbitrage` `copy-trading` `trading-bot` `rust` `polygon` `prediction-markets` `automated-trading` `defi` `ethereum` `blockchain` `market-making` `risk-management` `wallet-monitoring` `crypto-trading` `quantitative-trading` `algorithmic-trading` `polymarket-api` `polygon-blockchain` `smart-contracts` `web3` `trading-strategy` `arbitrage-bot` `copy-trade` `polymarket-bot`

<img width="1532" height="724" alt="image" src="https://github.com/user-attachments/assets/4acf9a5d-4ea4-435e-b0db-face455a60b3" />


## 📋 Table of Contents

- [Features](#features)
- [Quick Start](#setup)
- [Architecture](#architecture)
- [Configuration](#configuration)
- [How It Works](#how-it-works)
- [Strategy Logic](#strategy-logic)
- [Development](#development)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)
- [License](#license)
- [Contact](#contact)

## Topics

`polymarket` • `arbitrage` • `copy-trading` • `trading-bot` • `rust` • `polygon` • `prediction-markets` • `automated-trading` • `defi` • `ethereum` • `blockchain` • `market-making` • `risk-management` • `wallet-monitoring` • `crypto-trading` • `quantitative-trading` • `algorithmic-trading` • `polymarket-api` • `polygon-blockchain` • `smart-contracts` • `web3` • `trading-strategy` • `arbitrage-bot` • `copy-trade` • `polymarket-bot` • `trading-automation` • `crypto-arbitrage` • `defi-trading`

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
- High-performance async/await architecture
- Memory-safe Rust implementation

### 🛡️ Risk Management
- Total exposure limits
- Per-market position caps
- Daily loss limits
- Minimum liquidity requirements
- Slippage protection

## Contact

If you have any question or collaboration offer, feel free to text me. You're always welcome!

**Telegram**: [@cryp_mancer](https://t.me/cryp_mancer)

## Architecture

The bot is structured as a modular Rust application with clear separation of concerns:

```
src/
├── main.rs                  # Application entry point
├── bot.rs                   # Main orchestrator (PolymarketArbCopyBot)
├── config.rs                # Configuration management (load_config)
├── polymarket_client.rs     # Polymarket API client
├── arbitrage_detector.rs    # Arbitrage opportunity detection
├── wallet_monitor.rs        # Wallet activity monitoring
├── copy_trader.rs          # Copy trading execution engine
├── risk_manager.rs         # Risk limits and position tracking
├── order_executor.rs       # Order placement and management
└── on_chain_monitor.rs     # On-chain event monitoring
```

### Module Overview

- **`main.rs`**: Entry point that initializes the bot and handles graceful shutdown
- **`bot.rs`**: Main orchestrator that coordinates all components
- **`config.rs`**: Loads configuration from environment variables and provides typed config structs
- **`polymarket_client.rs`**: HTTP client for Polymarket APIs (CLOB, Gamma, Data APIs)
- **`arbitrage_detector.rs`**: Scans markets for arbitrage opportunities (internal and cross-platform)
- **`wallet_monitor.rs`**: Monitors target wallets for new trades and positions
- **`copy_trader.rs`**: Executes copy trades based on wallet activity and arbitrage signals
- **`risk_manager.rs`**: Enforces risk limits and tracks positions/exposure
- **`order_executor.rs`**: Manages order placement and cancellation
- **`on_chain_monitor.rs`**: On-chain event monitoring (Polygon blockchain)

## Setup

### Prerequisites

- **Rust 1.70+** (install from [rustup.rs](https://rustup.rs/))
- **Cargo** (comes with Rust installation)
- **Polygon RPC endpoint** (for on-chain monitoring)
- **Polymarket API access** (some endpoints may require authentication)

### 1. Install Rust

If you don't have Rust installed:

**Linux/macOS:**
```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source $HOME/.cargo/env
```

**Windows:**
Download and run the installer from [rustup.rs](https://rustup.rs/)

Verify installation:
```bash
rustc --version
cargo --version
```

### 2. Clone and Build

```bash
# Clone the repository (if applicable)
# cd polymarket-arbitrage-copy-bot

# Build the project
cargo build --release

# Or build in development mode
cargo build
```

### 3. Configure Environment

Create a `.env` file in the project root:

```bash
# Copy example (if available)
cp .env.example .env

# Or create manually
touch .env
```

Add the following configuration to `.env`:

```env
# Required: Target wallet to monitor
TARGET_WALLET_1=0x1234567890123456789012345678901234567890

# Required: Polygon RPC endpoint
POLYGON_RPC_URL=https://polygon-rpc.com

# Required: Your private key for signing orders
PRIVATE_KEY=your_private_key_here

# Optional: API key if needed
API_KEY=your_api_key_here

# Optional: Risk limits
MAX_TOTAL_EXPOSURE_USD=10000.0
MAX_POSITION_PER_MARKET_USD=2000.0
MAX_DAILY_LOSS_USD=500.0

# Optional: Arbitrage settings
MIN_ARB_PROFIT_PCT=0.01
MAX_ARB_PROFIT_PCT=0.05
INTERNAL_ARB_ENABLED=true
CROSS_PLATFORM_ENABLED=false

# Optional: Logging
LOG_LEVEL=INFO
```

**Key Environment Variables:**

| Variable | Required | Description |
|----------|----------|-------------|
| `TARGET_WALLET_1` | Yes | Wallet address to copy trade (get from Polymarket profile) |
| `PRIVATE_KEY` | Yes | Your private key for signing orders |
| `POLYGON_RPC_URL` | Yes | Polygon RPC endpoint for on-chain monitoring |
| `API_KEY` | No | Polymarket API key (if required) |
| `MAX_TOTAL_EXPOSURE_USD` | No | Maximum total exposure limit (default: 10000.0) |
| `MIN_ARB_PROFIT_PCT` | No | Minimum arbitrage profit % to execute (default: 0.01) |

### 4. Get Wallet Address

To find a wallet address from a Polymarket username:

1. Visit the profile page (e.g., `https://polymarket.com/@gabagool22`)
2. Open browser developer tools (F12)
3. Check the profile page source or network requests to find the wallet address
4. Alternatively, use Polymarket Analytics or Dune queries

### 5. Run the Bot

```bash
# Run in release mode (optimized)
cargo run --release

# Run in development mode (with debug info)
cargo run

# Run with custom log level
RUST_LOG=debug cargo run --release
RUST_LOG=info cargo run --release
```

## Configuration

### Wallet Configuration

Wallet configuration is loaded from environment variables via `src/config.rs`. You can modify the `load_config()` function to add more wallets or customize settings.

Configuration structure (defined in `config.rs`):

```rust
WalletConfig {
    address: String,              // Wallet address (0x...)
    name: String,                 // Wallet name/identifier
    enabled: bool,                // Whether to monitor this wallet
    min_win_rate: f64,            // Minimum win rate (0.0 to 1.0)
    max_position_size_usd: f64,   // Maximum position size in USD
    position_size_multiplier: f64, // Copy multiplier (0.0 to 1.0)
    markets_filter: Option<Vec<String>>, // Optional market filter
    require_arb_signal: bool,     // Only copy when arbitrage detected
}
```

Example configuration:
```rust
WalletConfig {
    address: "0x1234...".to_string(),
    name: "gabagool22".to_string(),
    enabled: true,
    min_win_rate: 0.70,
    max_position_size_usd: 2000.0,
    position_size_multiplier: 0.01,  // Copy 1% of wallet's position
    require_arb_signal: true,  // Only copy when arbitrage detected
}
```

### Arbitrage Settings

Configure arbitrage detection in `src/config.rs`:

- `min_arb_profit_pct`: Minimum profit % to execute (default: 1%)
- `max_arb_profit_pct`: Maximum expected profit % (default: 5%)
- `internal_arb_enabled`: Enable YES+NO arbitrage detection
- `cross_platform_enabled`: Enable cross-platform arbitrage (requires additional APIs)
- `min_liquidity_usd`: Minimum liquidity required (default: 1000.0)
- `max_slippage_pct`: Maximum acceptable slippage (default: 2%)

### Risk Limits

Configure risk management in `src/config.rs`:

- `max_total_exposure_usd`: Maximum total exposure across all positions
- `max_position_per_market_usd`: Maximum position size per market
- `max_daily_loss_usd`: Daily loss limit before pausing trading
- `enable_auto_hedge`: Automatically hedge unbalanced positions
- `min_balance_usd`: Minimum balance to keep (default: 100.0)

## How It Works

### 1. Initialization

When the bot starts (`main.rs` → `bot.rs`):
1. Loads configuration from environment variables
2. Initializes Polymarket API client
3. Sets up risk manager with configured limits
4. Initializes arbitrage detector
5. Creates copy traders for each monitored wallet
6. Starts wallet monitoring

### 2. Wallet Monitoring

The `WalletMonitor` continuously monitors configured wallet addresses:
- Polls Polymarket API for new positions/trades
- Tracks trade history and deduplicates
- Triggers callbacks when new trades are detected

### 3. Arbitrage Detection

The `ArbitrageDetector` scans markets for opportunities:
- **Internal Arbitrage**: Detects when YES + NO prices sum to < $1 (risk-free profit)
- **Cross-Platform**: Compares prices across platforms (extensible)
- Updates active opportunities map

### 4. Copy Trading with Filters

When a monitored wallet makes a trade:
1. `WalletMonitor` detects the new trade
2. `CopyTrader` processes the trade:
   - Checks if wallet meets criteria (enabled, win rate, etc.)
   - Verifies market filter (if configured)
   - **If `require_arb_signal=true`**: Checks for arbitrage opportunity
   - Calculates position size (scaled by multiplier)
   - Checks risk limits via `RiskManager`
   - Executes trade via `OrderExecutor`

### 5. Risk Management

The `RiskManager` enforces limits:
- Tracks all open positions
- Calculates total exposure
- Monitors daily PnL
- Validates new position requests against limits
- Suggests hedging for unbalanced positions

### 6. Order Execution

The `OrderExecutor` handles order placement:
- Places orders via Polymarket API
- Tracks active orders
- Handles order cancellation
- Updates risk manager on successful orders

## Strategy Logic

### Pure Arbitrage Mode

When an internal arbitrage opportunity is detected:
- Buy both YES and NO tokens simultaneously
- Lock in guaranteed profit on market resolution
- Profit = $1 - (YES_price + NO_price) - fees

Example:
- YES price: $0.48
- NO price: $0.49
- Total: $0.97
- Profit: $0.03 per $1 invested (3% before fees)

### Copy Trading Mode

When copying a wallet trade:
- Replicate the trade proportionally (based on multiplier)
- Only execute if arbitrage signal exists (if `require_arb_signal=true`)
- Scale position size by configured multiplier
- Maintain risk limits

Example:
- Monitored wallet buys $1000 of YES
- Position multiplier: 0.01 (1%)
- Your position: $10 of YES

### Hybrid Mode (Recommended)

- Monitor arbitrage-focused wallets
- Copy their trades when arbitrage opportunities align
- Combines reliability of arb with directional upside
- Filters trades through arbitrage detector

## Project Structure

```
polymarket-arbitrage-copy-bot/
├── Cargo.toml              # Rust project configuration and dependencies
├── Cargo.lock              # Dependency lock file (auto-generated)
├── README.md               # This file
├── .env                    # Environment variables (create this)
├── .gitignore             # Git ignore patterns
│
├── src/
│   ├── main.rs            # Application entry point
│   ├── bot.rs             # Main bot orchestrator
│   ├── config.rs          # Configuration management
│   ├── polymarket_client.rs    # Polymarket API client
│   ├── arbitrage_detector.rs   # Arbitrage detection logic
│   ├── wallet_monitor.rs       # Wallet monitoring
│   ├── copy_trader.rs          # Copy trading engine
│   ├── risk_manager.rs         # Risk management
│   ├── order_executor.rs       # Order execution
│   └── on_chain_monitor.rs     # On-chain monitoring
│
└── target/                # Build output (gitignored)
    ├── debug/             # Development builds
    └── release/           # Release builds
```

## Development

### Running Tests

```bash
# Run all tests
cargo test

# Run tests with output
cargo test -- --nocapture

# Run specific test
cargo test test_name
```

### Building for Production

```bash
# Build optimized release binary
cargo build --release

# The binary will be at:
# target/release/polymarket-arbitrage-copy-bot (Unix)
# target/release/polymarket-arbitrage-copy-bot.exe (Windows)
```

### Development Workflow

```bash
# Format code
cargo fmt

# Lint code
cargo clippy

# Check for issues without building
cargo check

# Run in development mode
cargo run
```

### Debugging

```bash
# Run with debug logging
RUST_LOG=debug cargo run

# Run with trace logging (very verbose)
RUST_LOG=trace cargo run

# Run specific module logging
RUST_LOG=polymarket_arbitrage_copy_bot::bot=debug cargo run
```

## Logging

The bot uses the `log` crate with `env_logger` for logging.

**Log Levels:**
- `error`: Error conditions
- `warn`: Warning conditions
- `info`: Informational messages (default)
- `debug`: Debug-level messages
- `trace`: Trace-level messages (very verbose)

**Configure Logging:**
```bash
# Set log level via environment variable
RUST_LOG=info cargo run
RUST_LOG=debug cargo run
RUST_LOG=warn cargo run

# Or set in .env file
LOG_LEVEL=DEBUG
```

## Dependencies

Key dependencies (see `Cargo.toml` for full list):

- **tokio**: Async runtime
- **reqwest**: HTTP client
- **serde/serde_json**: JSON serialization
- **anyhow**: Error handling
- **ethers**: Ethereum/Polygon integration
- **chrono**: Date/time handling
- **log/env_logger**: Logging
- **dotenv**: Environment variable loading
- **tokio-tungstenite**: WebSocket support

## Important Notes

### ⚠️ Current Limitations

- **On-Chain Event Parsing**: May need refinement based on actual Polymarket contract event structure
- **API Response Format**: Order book transformation assumes specific format - may need adjustment
- **Cross-Platform Arb**: Requires external API integrations (Kalshi, etc.) - not critical for basic functionality
- **Order Signing**: EIP-712 signature implementation may need adjustment based on Polymarket's exact requirements

### 🔧 Implementation Notes

- The bot is designed to be extensible - add your own API integrations
- WebSocket support is included for real-time updates (can be extended)
- All components use async/await (Tokio) for high performance
- Rust provides memory safety and excellent performance
- Thread-safe design using `Arc` and `Mutex`/`RwLock` where needed

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
- **Private Keys**: Never commit private keys to version control
- **Production Use**: Review and test all code before using with real funds

## Extending the Bot

### Add Cross-Platform Arbitrage

1. Integrate Kalshi API (or other platform) in `arbitrage_detector.rs`
2. Implement market matching logic
3. Add price comparison and profit calculation
4. Update `ArbitrageConfig` to include new platform settings

### Improve Wallet Monitoring

1. Implement on-chain event parsing using `ethers-rs` in `on_chain_monitor.rs`
2. Use Polymarket's activity API if available
3. Add WebSocket subscriptions for real-time updates
4. Implement position tracking with deduplication

### Add More Filters

- Win rate tracking per wallet
- Market category filters
- Time-based filters (e.g., only trade during certain hours)
- Volume-based filters
- Price movement filters

### Add Features

- Backtesting capabilities
- Performance metrics and analytics
- Database persistence for trades/positions
- Web dashboard for monitoring
- Telegram/Discord notifications

## Troubleshooting

### Common Issues

**"No wallets configured" error:**
- Ensure `TARGET_WALLET_1` is set in `.env` file
- Check that the wallet address is valid (starts with `0x`)

**API connection errors:**
- Verify `POLYGON_RPC_URL` is correct and accessible
- Check network connectivity
- Some RPC endpoints have rate limits

**Compilation errors:**
- Ensure Rust is up to date: `rustup update`
- Clear build cache: `cargo clean`
- Check that all dependencies are compatible

**Runtime errors:**
- Enable debug logging: `RUST_LOG=debug cargo run`
- Check `.env` file for missing required variables
- Verify API endpoints are accessible

## Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

This is a starting point for a trading bot. Key areas for improvement:

1. Complete API integrations (wallet monitoring, order signing)
2. Add cross-platform arbitrage detection
3. Implement advanced risk metrics
4. Add backtesting capabilities
5. Performance optimizations
6. Add comprehensive tests
7. Improve error handling
8. Add monitoring and alerting

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

**DISCLAIMER**: This software is provided "as is" without warranty of any kind. Trading cryptocurrencies and prediction markets involves substantial risk of loss. The authors are not responsible for any losses incurred from using this software.

## Contact

For questions, collaboration, or support:

**Telegram**: [@cryp_mancer](https://t.me/cryp_mancer)

---

**Note**: This bot is for educational and research purposes. Always test thoroughly before using with real funds. Start with small positions and understand the risks involved in automated trading.
