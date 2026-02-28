use anyhow::{Context, Result};
use std::env;
use std::path::PathBuf;

#[derive(Debug, Clone)]
pub struct Config {
    pub private_key: String,
    pub target_wallet: String,
    pub chain_id: u64,
    pub clob_api_url: String,
    pub ws_url: String,
    pub rpc_url: String,
    pub size_multiplier: f64,
    pub max_order_amount: Option<f64>,
    pub order_type: OrderType,
    pub tick_size: TickSize,
    pub neg_risk: bool,
    pub enable_copy_trading: bool,
    pub redeem_duration_minutes: Option<u64>,
    pub credential_path: PathBuf,
    pub holdings_path: PathBuf,
    pub debug: bool,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum OrderType {
    FOK,
    FAK,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TickSize {
    Tick01,
    Tick001,
    Tick0001,
    Tick00001,
}

impl TickSize {
    pub fn as_str(&self) -> &'static str {
        match self {
            TickSize::Tick01 => "0.1",
            TickSize::Tick001 => "0.01",
            TickSize::Tick0001 => "0.001",
            TickSize::Tick00001 => "0.0001",
        }
    }
}

impl Config {
    pub fn from_env() -> Result<Self> {
        dotenvy::dotenv().ok();

        let private_key = env::var("PRIVATE_KEY").context("PRIVATE_KEY not set")?;
        let target_wallet = env::var("TARGET_WALLET").context("TARGET_WALLET not set")?;

        let chain_id: u64 = env::var("CHAIN_ID")
            .unwrap_or_else(|_| "137".to_string())
            .parse()
            .unwrap_or(137);

        let clob_api_url = env::var("CLOB_API_URL")
            .unwrap_or_else(|_| "https://clob.polymarket.com".to_string());
        let ws_url = env::var("USER_REAL_TIME_DATA_URL")
            .unwrap_or_else(|_| "wss://ws-live-data.polymarket.com".to_string());

        let rpc_url = env::var("RPC_URL")
            .or_else(|_| env::var("RPC_TOKEN"))
            .unwrap_or_else(|_| {
                if chain_id == 137 {
                    "https://polygon-rpc.com".to_string()
                } else if chain_id == 80002 {
                    "https://rpc-amoy.polygon.technology".to_string()
                } else {
                    "https://polygon-rpc.com".to_string()
                }
            });

        let size_multiplier: f64 = env::var("SIZE_MULTIPLIER")
            .unwrap_or_else(|_| "1.0".to_string())
            .parse()
            .unwrap_or(1.0);

        let max_order_amount = env::var("MAX_ORDER_AMOUNT").ok().and_then(|s| s.parse().ok());

        let order_type = match env::var("ORDER_TYPE").as_deref().unwrap_or("").to_uppercase().as_str() {
            "FOK" => OrderType::FOK,
            _ => OrderType::FAK,
        };

        let tick_size = match env::var("TICK_SIZE").as_deref().unwrap_or("0.01") {
            "0.1" => TickSize::Tick01,
            "0.001" => TickSize::Tick0001,
            "0.0001" => TickSize::Tick00001,
            _ => TickSize::Tick001,
        };

        let neg_risk = env::var("NEG_RISK").unwrap_or_else(|_| "false".to_string()) == "true";
        let enable_copy_trading = env::var("ENABLE_COPY_TRADING").unwrap_or_else(|_| "true".to_string()) != "false";
        let redeem_duration_minutes = env::var("REDEEM_DURATION").ok().and_then(|s| s.parse().ok());
        let debug = env::var("DEBUG").unwrap_or_else(|_| "false".to_string()) == "true";

        let base = env::current_dir().unwrap_or_else(|_| PathBuf::from("."));
        let credential_path = env::var("CREDENTIAL_PATH")
            .map(PathBuf::from)
            .unwrap_or_else(|_| base.join("src").join("data").join("credential.json"));
        let holdings_path = env::var("HOLDINGS_PATH")
            .map(PathBuf::from)
            .unwrap_or_else(|_| base.join("src").join("data").join("token-holding.json"));

        Ok(Config {
            private_key: private_key.trim().to_string(),
            target_wallet: target_wallet.trim().to_string(),
            chain_id,
            clob_api_url,
            ws_url,
            rpc_url,
            size_multiplier,
            max_order_amount,
            order_type,
            tick_size,
            neg_risk,
            enable_copy_trading,
            redeem_duration_minutes,
            credential_path,
            holdings_path,
            debug,
        })
    }
}
