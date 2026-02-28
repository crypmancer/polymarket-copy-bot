# Polymarket Copy Bot (Rust)

Rust port of the Polymarket copy-trading bot. Same behavior as the TypeScript version: watch a target wallet’s trades in real time and mirror them with configurable size and optional auto-redemption.

## Requirements

- **Rust** 1.70+
- **Polygon** wallet with USDC for trading and gas

## Build

```bash
cd rust
cargo build --release
```

## Configuration

Use the same `.env` as the TypeScript bot (in the **project root**, not inside `rust/`). Required and optional variables:

| Variable | Required | Description |
|----------|----------|-------------|
| `PRIVATE_KEY` | Yes | Your wallet private key. |
| `TARGET_WALLET` | Yes* | Address of the wallet whose trades to copy. |
| `RPC_URL` / `RPC_TOKEN` | Yes** | Polygon RPC URL for chain and contract calls. |
| `CHAIN_ID` | No | Chain ID (default: 137). |
| `CLOB_API_URL` | No | CLOB API base URL (default: `https://clob.polymarket.com`). |
| `USER_REAL_TIME_DATA_URL` | No | WebSocket URL (default: `wss://ws-live-data.polymarket.com`). |
| `SIZE_MULTIPLIER` | No | Multiply copied size (default: `1.0`). |
| `MAX_ORDER_AMOUNT` | No | Cap per order size. |
| `ORDER_TYPE` | No | `FAK` or `FOK` (default: `FAK`). |
| `TICK_SIZE` | No | `0.1`, `0.01`, `0.001`, `0.0001` (default: `0.01`). |
| `NEG_RISK` | No | `true` / `false`. |
| `ENABLE_COPY_TRADING` | No | `true` / `false` (default: `true`). |
| `REDEEM_DURATION` | No | Auto-redeem interval in **minutes**. |
| `DEBUG` | No | `true` for extra logging. |

\* Required when copy trading is enabled.  
\** Required for allowances and redemption.

Run from the **repository root** so that paths like `src/data/credential.json` and `src/data/token-holding.json` resolve correctly (or set `CREDENTIAL_PATH` and `HOLDINGS_PATH`).

## Commands

```bash
# From repo root (so .env and src/data/ are found)
cd polymarket-copy-bot
cargo run --manifest-path rust/Cargo.toml -- bot
cargo run --manifest-path rust/Cargo.toml -- redeem <conditionId> [indexSet1 indexSet2 ...]
cargo run --manifest-path rust/Cargo.toml -- auto-redeem [--dry-run] [--api]
```

Or from `rust/` after copying/linking `.env` and ensuring data paths point to the same files as the TS bot:

```bash
cd rust
cargo run --release -- bot
cargo run --release -- redeem 0x... 1 2
cargo run --release -- auto-redeem
```

## Current status

- **Config & env** – Same env vars and semantics as TS.
- **Credentials** – Load from `credential.json`; derive API key via L1 auth if file missing.
- **CLOB** – L2 HMAC auth, `get_balance_allowance`, `update_balance_allowance`, `get_open_orders`.
- **Chain** – Polygon RPC, contract addresses (137 / 80002), USDC and CTF approvals.
- **Feed** – WebSocket connection and subscribe to `activity:trades`; filter by `TARGET_WALLET`.
- **Order builder** – Trade → market order (BUY/SELL), balance checks, holdings add/remove.
- **Holdings** – JSON file load/save; same format as TS (`token-holding.json`).
- **Redemption** – Stubbed; use the TypeScript `redeem` / `auto-redeem` scripts for actual redemption.
- **Market order posting** – Not implemented in Rust (EIP-712 order signing for CLOB is pending). The bot runs the feed and balance/holdings logic; for live order execution use the TypeScript bot or add full order signing here.

## Compatibility

- Reuses the same `.env`, `src/data/credential.json`, and `src/data/token-holding.json` as the TypeScript bot.
- Create credentials once (e.g. with the TS bot or by implementing L1 create in Rust); the Rust bot can then load and use them.
