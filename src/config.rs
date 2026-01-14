use serde::{Deserialize, Serialize};
use std::env;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WalletConfig {
    pub address: String,
    pub name: String,
    pub enabled: bool,
    pub min_win_rate: f64,
    pub max_position_size_usd: f64,
    pub position_size_multiplier: f64,
    pub markets_filter: Option<Vec<String>>,
    pub require_arb_signal: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ArbitrageConfig {
    pub min_arb_profit_pct: f64,
    pub max_arb_profit_pct: f64,
    pub internal_arb_enabled: bool,
    pub cross_platform_enabled: bool,
    pub min_liquidity_usd: f64,
    pub max_slippage_pct: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RiskConfig {
    pub max_total_exposure_usd: f64,
    pub max_position_per_market_usd: f64,
    pub max_daily_loss_usd: f64,
    pub enable_auto_hedge: bool,
    pub min_balance_usd: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PolymarketConfig {
    pub clob_api_url: String,
    pub gamma_api_url: String,
    pub data_api_url: String,
    pub ws_url: String,
    pub private_key: Option<String>,
    pub api_key: Option<String>,
    pub chain_id: u64,
    pub rpc_url: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BotConfig {
    pub wallets: Vec<WalletConfig>,
    pub arbitrage: ArbitrageConfig,
    pub risk: RiskConfig,
    pub polymarket: PolymarketConfig,
    pub enabled_markets: Option<Vec<String>>,
    pub min_market_volume_24h: f64,
    pub max_concurrent_positions: usize,
    pub wallet_check_interval_seconds: f64,
    pub arb_scan_interval_seconds: f64,
    pub log_level: String,
}

pub fn load_config() -> BotConfig {
    dotenv::dotenv().ok();

    let mut wallets: Vec<WalletConfig> = Vec::new();

    if let Ok(target_wallet_1) = env::var("TARGET_WALLET_1") {
        wallets.push(WalletConfig {
            address: target_wallet_1,
            name: "gabagool22".to_string(),
            enabled: true,
            min_win_rate: 0.70,
            max_position_size_usd: 2000.0,
            position_size_multiplier: 0.01,
            markets_filter: None,
            require_arb_signal: true,
        });
    }

    let min_arb_profit_pct = env::var("MIN_ARB_PROFIT_PCT")
        .unwrap_or_else(|_| "0.01".to_string())
        .parse::<f64>()
        .unwrap_or(0.01);

    let max_arb_profit_pct = env::var("MAX_ARB_PROFIT_PCT")
        .unwrap_or_else(|_| "0.05".to_string())
        .parse::<f64>()
        .unwrap_or(0.05);

    let internal_arb_enabled = env::var("INTERNAL_ARB_ENABLED")
        .unwrap_or_else(|_| "true".to_string())
        .to_lowercase() == "true";

    let cross_platform_enabled = env::var("CROSS_PLATFORM_ENABLED")
        .unwrap_or_else(|_| "false".to_string())
        .to_lowercase() == "true";

    let max_total_exposure_usd = env::var("MAX_TOTAL_EXPOSURE_USD")
        .unwrap_or_else(|_| "10000.0".to_string())
        .parse::<f64>()
        .unwrap_or(10000.0);

    let max_position_per_market_usd = env::var("MAX_POSITION_PER_MARKET_USD")
        .unwrap_or_else(|_| "2000.0".to_string())
        .parse::<f64>()
        .unwrap_or(2000.0);

    let max_daily_loss_usd = env::var("MAX_DAILY_LOSS_USD")
        .unwrap_or_else(|_| "500.0".to_string())
        .parse::<f64>()
        .unwrap_or(500.0);

    BotConfig {
        wallets,
        arbitrage: ArbitrageConfig {
            min_arb_profit_pct,
            max_arb_profit_pct,
            internal_arb_enabled,
            cross_platform_enabled,
            min_liquidity_usd: 1000.0,
            max_slippage_pct: 0.02,
        },
        risk: RiskConfig {
            max_total_exposure_usd,
            max_position_per_market_usd,
            max_daily_loss_usd,
            enable_auto_hedge: true,
            min_balance_usd: 100.0,
        },
        polymarket: PolymarketConfig {
            clob_api_url: "https://clob.polymarket.com".to_string(),
            gamma_api_url: "https://gamma-api.polymarket.com".to_string(),
            data_api_url: "https://data-api.polymarket.com".to_string(),
            ws_url: "wss://ws-subscriptions-clob.polymarket.com/ws/".to_string(),
            private_key: env::var("PRIVATE_KEY").ok(),
            api_key: env::var("API_KEY").ok(),
            chain_id: 137,
            rpc_url: env::var("POLYGON_RPC_URL")
                .ok()
                .or_else(|| Some("https://polygon-rpc.com".to_string())),
        },
        enabled_markets: None,
        min_market_volume_24h: 5000.0,
        max_concurrent_positions: 10,
        wallet_check_interval_seconds: 1.0,
        arb_scan_interval_seconds: 0.5,
        log_level: env::var("LOG_LEVEL").unwrap_or_else(|_| "INFO".to_string()),
    }
}
