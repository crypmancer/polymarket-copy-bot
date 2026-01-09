# Bot Workflow - Step by Step

This document explains the complete workflow of the Polymarket Arbitrage + Copy Trading Bot in simple terms.

## 🚀 Startup Sequence

```
1. Bot Starts (npm start)
   │
   ├─> Load Configuration (.env file)
   │   ├─> Read wallet addresses to monitor
   │   ├─> Read risk limits
   │   ├─> Read arbitrage thresholds
   │   └─> Read API credentials
   │
   ├─> Initialize Components
   │   ├─> PolymarketClient → Connect to API
   │   ├─> RiskManager → Set exposure limits
   │   ├─> ArbitrageDetector → Configure profit thresholds
   │   ├─> OrderExecutor → Ready to place orders
   │   ├─> CopyTrader (one per wallet) → Link to detector & risk manager
   │   └─> WalletMonitor → Register callback for new trades
   │
   └─> Start 3 Concurrent Loops
```

## 🔄 Main Execution - Three Parallel Loops

The bot runs **three loops simultaneously** that never stop:

### Loop 1: Wallet Monitoring (Every 1 second)

```
┌─────────────────────────────────────────┐
│  Wallet Monitor Loop                    │
│  (Runs every 1 second)                  │
└─────────────────────────────────────────┘
           │
           ▼
    For each wallet address:
           │
           ├─> Query Polymarket API
           │   "What trades did this wallet make since last check?"
           │
           ├─> Parse trade data:
           │   ├─> Market ID
           │   ├─> Outcome (YES or NO)
           │   ├─> Side (buy or sell)
           │   ├─> Price
           │   └─> Size (USD value)
           │
           └─> If NEW trade found:
                   │
                   └─> Trigger: handleWalletTrade()
                       └─> CopyTrader.processTrade()
```

### Loop 2: Arbitrage Scanning (Every 0.5 seconds)

```
┌─────────────────────────────────────────┐
│  Arbitrage Scanner Loop                 │
│  (Runs every 0.5 seconds)               │
└─────────────────────────────────────────┘
           │
           ▼
    Fetch active markets from Polymarket
           │
           ├─> Filter markets:
           │   ├─> Minimum 24h volume?
           │   └─> In enabled list?
           │
           ▼
    For each market:
           │
           ├─> Get order book (current prices)
           │   ├─> YES token best ask price
           │   └─> NO token best ask price
           │
           ├─> Calculate: YES_price + NO_price
           │
           ├─> Add fee buffer (~1%)
           │
           └─> If total < $0.99:
                   │
                   └─> ✅ ARBITRAGE FOUND!
                       ├─> Calculate profit %
                       ├─> Check liquidity
                       └─> Store in activeOpportunities map
```

### Loop 3: Status Reporting (Every 60 seconds)

```
┌─────────────────────────────────────────┐
│  Status Report Loop                     │
│  (Runs every 60 seconds)                │
└─────────────────────────────────────────┘
           │
           ▼
    Collect metrics:
           ├─> Total exposure
           ├─> Daily PnL
           ├─> Open positions
           ├─> Active orders
           └─> Wallet statistics
           │
           └─> Log status to console
```

## 💼 Copy Trading Decision Flow

When Loop 1 detects a new wallet trade, here's what happens:

```
Wallet Trade Detected
        │
        ▼
┌───────────────────────────────────────┐
│  CopyTrader.processTrade()            │
└───────────────────────────────────────┘
        │
        ├─> ❓ Already copied this trade?
        │   └─> YES → Skip, return false
        │
        ├─> ❓ Wallet enabled & meets criteria?
        │   └─> NO → Skip, return false
        │
        ├─> ❓ Market in filter list?
        │   └─> NO → Skip, return false
        │
        ├─> ❓ requireArbSignal = true?
        │   │
        │   ├─> YES → Check ArbitrageDetector
        │   │   ├─> Has opportunity for this market?
        │   │   │   └─> NO → Skip, return false
        │   │   └─> YES → Continue
        │   │
        │   └─> NO → Continue
        │
        ├─> Calculate position size:
        │   ├─> Base: trade.sizeUsd (wallet's position)
        │   ├─> Apply: positionSizeMultiplier (e.g., 0.01 = 1%)
        │   ├─> Cap: maxPositionSizeUsd
        │   └─> Min: $10 (viable size)
        │
        ├─> ❓ RiskManager.canOpenPosition()?
        │   ├─> Check daily loss limit
        │   ├─> Check total exposure limit
        │   ├─> Check per-market exposure limit
        │   └─> NO → Skip, return false
        │
        └─> ✅ All checks passed → Execute Trade
```

## 🎯 Trade Execution

When all checks pass, the bot executes:

```
Execute Trade
        │
        ├─> ❓ Is this an arbitrage opportunity?
        │   │
        │   ├─> YES (internal arb detected):
        │   │   │
        │   │   ├─> Split position 50/50:
        │   │   │   ├─> YES_size = total * 0.5
        │   │   │   └─> NO_size = total * 0.5
        │   │   │
        │   │   ├─> Calculate shares:
        │   │   │   ├─> YES_shares = YES_size / YES_price
        │   │   │   └─> NO_shares = NO_size / NO_price
        │   │   │
        │   │   ├─> Place Order 1: Buy YES
        │   │   ├─> Place Order 2: Buy NO
        │   │   │
        │   │   ├─> Both succeed?
        │   │   │   ├─> YES → Record positions, profit locked! ✅
        │   │   │   └─> NO → Cancel other order, return false
        │   │
        │   └─> NO (directional copy):
        │       │
        │       ├─> Calculate shares: positionSizeUsd / price
        │       │
        │       ├─> Place order:
        │       │   ├─> Same market
        │       │   ├─> Same outcome (YES/NO)
        │       │   ├─> Same side (buy/sell)
        │       │   ├─> Same price
        │       │   └─> Scaled size
        │       │
        │       └─> Success?
        │           ├─> YES → Record position ✅
        │           └─> NO → Log error
```

## 📊 Risk Management Check (Detailed)

Before any trade, RiskManager checks:

```
RiskManager.canOpenPosition()
        │
        ├─> Check 1: Daily Loss Limit
        │   ├─> dailyPnl <= -maxDailyLossUsd?
        │   └─> YES → ❌ REJECT (hard stop)
        │
        ├─> Check 2: Total Exposure Limit
        │   ├─> (currentExposure + newPosition) > maxTotalExposureUsd?
        │   └─> YES → ❌ REJECT
        │
        └─> Check 3: Per-Market Exposure Limit
            ├─> (marketExposure + newPosition) > maxPositionPerMarketUsd?
            └─> YES → ❌ REJECT
            │
            └─> All checks pass → ✅ ALLOW
```

## 🔍 Arbitrage Detection (Detailed)

How the bot finds arbitrage opportunities:

```
ArbitrageDetector.scanMarket()
        │
        ├─> Get order book for market
        │   ├─> YES token: best ask price
        │   └─> NO token: best ask price
        │
        ├─> Calculate:
        │   ├─> totalCost = YES_price + NO_price
        │   └─> feeAdjustedCost = totalCost * 1.01 (1% fees)
        │
        ├─> Check: feeAdjustedCost < $0.99?
        │   └─> NO → No arbitrage, return null
        │
        ├─> YES → Calculate profit:
        │   ├─> profitPct = (1.0 - feeAdjustedCost) / feeAdjustedCost
        │   ├─> profitUsd = profitPct * 1.0
        │   └─> liquidity = min(YES_liquidity, NO_liquidity)
        │
        ├─> Validate opportunity:
        │   ├─> profitPct >= minArbProfitPct? (e.g., 1%)
        │   ├─> profitPct <= maxArbProfitPct? (e.g., 5%)
        │   ├─> liquidity >= minLiquidityUsd? (e.g., $1000)
        │   └─> All pass → ✅ Valid arbitrage opportunity
        │
        └─> Store in activeOpportunities map
```

## 📈 Example: Complete Flow

Here's a real example of what happens:

```
1. Bot starts, initializes all components
   └─> Ready to monitor wallet: 0xABC... (gabagool22)

2. Loop 1 (Wallet Monitor):
   └─> Checks wallet 0xABC... every 1 second
       └─> No new trades yet

3. Loop 2 (Arbitrage Scanner):
   └─> Scans markets every 0.5 seconds
       └─> Market "Will BTC hit $50k by Friday?"
           ├─> YES price: $0.48
           ├─> NO price: $0.49
           ├─> Total: $0.97
           ├─> With fees: $0.9797
           └─> ✅ Arbitrage! (1 - 0.9797 = 2.07% profit)
               └─> Stored in activeOpportunities

4. Loop 1 detects new trade:
   └─> Wallet 0xABC... just bought YES @ $0.48
       └─> Market: "Will BTC hit $50k by Friday?"
           └─> Triggers handleWalletTrade()

5. CopyTrader.processTrade():
   ├─> ✅ Not already copied
   ├─> ✅ Wallet enabled
   ├─> ✅ requireArbSignal = true
   ├─> ✅ ArbitrageDetector.hasOpportunity() = true
   ├─> ✅ Position size: $2000 * 0.01 = $20
   ├─> ✅ RiskManager.canOpenPosition() = true
   └─> ✅ Execute trade

6. Execute arbitrage trade:
   ├─> Buy YES: $10 @ $0.48 = 20.83 shares
   ├─> Buy NO: $10 @ $0.49 = 20.41 shares
   ├─> Both orders succeed ✅
   └─> Profit locked: $20 → $20.41 on resolution (2.07%)

7. RiskManager records:
   ├─> Total exposure: +$20
   └─> Market exposure: +$20

8. Status report (60 seconds later):
   └─> Logs: "Total Exposure: $20, Daily PnL: $0, Open Positions: 2"
```

## 🎯 Key Concepts

### Why This Works

1. **Arbitrage Detection**: Finds risk-free profit opportunities (YES + NO < $1)
2. **Copy Trading**: Replicates successful wallet strategies
3. **Hybrid Approach**: Only copies when arbitrage exists → safer + more profitable
4. **Risk Management**: Multiple layers of protection prevent over-exposure

### The Magic Formula

```
Copy Trade = Wallet Trade + Arbitrage Signal + Risk Check + Execute
```

Only when ALL conditions are met does the bot trade.

## 🔄 Continuous Operation

The bot runs indefinitely until:
- Manual stop (Ctrl+C)
- Daily loss limit reached
- System shutdown

All three loops continue running in parallel, constantly:
- Monitoring wallets
- Scanning for arbitrage
- Reporting status

This creates a **self-sustaining trading system** that automatically finds and executes profitable opportunities!

