use crate::config::WalletConfig;
use crate::polymarket_client::PolymarketClient;
use chrono::{DateTime, Utc};
use std::collections::{HashMap, HashSet};

#[derive(Debug, Clone)]
pub struct WalletTrade {
    pub wallet_address: String,
    pub wallet_name: String,
    pub market_id: String,
    pub market_question: String,
    pub outcome: String,
    pub side: String,
    pub price: f64,
    pub size: f64,
    pub size_usd: f64,
    pub timestamp: DateTime<Utc>,
    pub tx_hash: Option<String>,
}

pub struct WalletMonitor {
    wallet_configs: HashMap<String, WalletConfig>,
    pm_client: std::sync::Arc<PolymarketClient>,
    trade_callback: Option<Box<dyn Fn(WalletTrade) -> std::pin::Pin<Box<dyn std::future::Future<Output = ()> + Send>> + Send + Sync>>,
    last_trade_timestamps: HashMap<String, DateTime<Utc>>,
    trade_history: HashMap<String, Vec<WalletTrade>>,
    last_known_positions: HashMap<String, HashSet<String>>,
    running: std::sync::Arc<tokio::sync::RwLock<bool>>,
    check_count: HashMap<String, usize>,
}

impl WalletMonitor {
    pub fn new(
        wallet_configs: Vec<WalletConfig>,
        polymarket_client: std::sync::Arc<PolymarketClient>,
    ) -> Self {
        let wallet_configs_map: HashMap<String, WalletConfig> = wallet_configs
            .into_iter()
            .filter(|wc| wc.enabled)
            .map(|wc| (wc.address.clone(), wc))
            .collect();

        let mut trade_history = HashMap::new();
        for address in wallet_configs_map.keys() {
            trade_history.insert(address.clone(), Vec::new());
        }

        Self {
            wallet_configs: wallet_configs_map,
            pm_client: polymarket_client,
            trade_callback: None,
            last_trade_timestamps: HashMap::new(),
            trade_history,
            last_known_positions: HashMap::new(),
            running: std::sync::Arc::new(tokio::sync::RwLock::new(false)),
            check_count: HashMap::new(),
        }
    }

    pub async fn start_monitoring(&self, check_interval: f64) {
        *self.running.write().await = true;
        log::info!(
            "Starting wallet monitoring for {} wallets",
            self.wallet_configs.len()
        );

        while *self.running.read().await {
            self.check_all_wallets().await;
            tokio::time::sleep(tokio::time::Duration::from_secs_f64(check_interval)).await;
        }
    }

    pub fn set_trade_callback<F>(&mut self, callback: F)
    where
        F: Fn(WalletTrade) -> std::pin::Pin<Box<dyn std::future::Future<Output = ()> + Send>> + Send + Sync + 'static,
    {
        self.trade_callback = Some(Box::new(callback));
    }

    pub fn stop_monitoring(&self) {
        tokio::spawn({
            let running = self.running.clone();
            async move {
                *running.write().await = false;
            }
        });
        log::info!("Stopped wallet monitoring");
    }

    async fn check_all_wallets(&self) {
        let addresses: Vec<String> = self.wallet_configs.keys().cloned().collect();
        for address in addresses {
            self.check_wallet(&address).await;
        }
    }

    async fn check_wallet(&self, wallet_address: &str) {
        let config = match self.wallet_configs.get(wallet_address) {
            Some(cfg) => cfg.clone(),
            None => return,
        };

        let since = self.last_trade_timestamps.get(wallet_address).copied();
        let trades = self
            .pm_client
            .get_wallet_trades(wallet_address, since, 100)
            .await;

        let check_count = self.check_count.get(wallet_address).copied().unwrap_or(0) + 1;
        // self.check_count.insert(wallet_address.to_string(), check_count);

        if check_count % 60 == 0 {
            let last_check = since
                .map(|s| format!("Last trade: {}", s.to_rfc3339()))
                .unwrap_or_else(|| "No previous trades".to_string());
            log::info!(
                "[{}] Monitoring active - Check #{}, {} new trades found, {}",
                config.name,
                check_count,
                trades.len(),
                last_check
            );
        }

        for trade_data in trades {
            if let Some(trade) = self.parse_trade(&trade_data, &config) {
                // Check if this is a new trade (by position ID if available)
                if let Some(position_id) = trade_data.get("positionId").and_then(|v| v.as_str()) {
                    let known_positions = self
                        .last_known_positions
                        .get(wallet_address)
                        .cloned()
                        .unwrap_or_default();
                    if known_positions.contains(position_id) {
                        continue; // Already seen this position
                    }
                    let mut updated = known_positions;
                    updated.insert(position_id.to_string());
                    // self.last_known_positions.insert(wallet_address.to_string(), updated);
                }

                if self.is_new_trade(&trade, wallet_address) {
                    log::info!(
                        "New trade from {}: {} {:.2} USD of {} @ {:.4} in {}",
                        config.name,
                        trade.side,
                        trade.size_usd,
                        trade.outcome,
                        trade.price,
                        trade.market_question
                    );

                    // Add to history
                    if let Some(history) = self.trade_history.get_mut(wallet_address) {
                        history.push(trade.clone());
                    }

                    // Update last timestamp
                    // self.last_trade_timestamps.insert(wallet_address.to_string(), trade.timestamp);

                    // Call callback if provided
                    if let Some(callback) = &self.trade_callback {
                        callback(trade).await;
                    }
                }
            }
        }
    }

    fn parse_trade(&self, trade_data: &serde_json::Value, config: &WalletConfig) -> Option<WalletTrade> {
        let market_id = trade_data
            .get("marketId")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string())?;

        let market_question = trade_data
            .get("question")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();

        let outcome = trade_data
            .get("outcome")
            .and_then(|v| v.as_str())
            .unwrap_or("YES")
            .to_uppercase();

        let side = trade_data
            .get("side")
            .and_then(|v| v.as_str())
            .unwrap_or("buy")
            .to_lowercase();

        let price = trade_data
            .get("price")
            .and_then(|v| v.as_f64())
            .unwrap_or(0.0);

        let size = trade_data
            .get("size")
            .and_then(|v| v.as_f64())
            .unwrap_or(0.0);

        let size_usd = size * price;

        let timestamp = trade_data
            .get("timestamp")
            .and_then(|v| v.as_str())
            .and_then(|s| DateTime::parse_from_rfc3339(s).ok())
            .map(|dt| dt.with_timezone(&Utc))
            .unwrap_or_else(Utc::now);

        let tx_hash = trade_data
            .get("txHash")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());

        if !["YES", "NO"].contains(&outcome.as_str())
            || !["buy", "sell"].contains(&side.as_str())
            || price <= 0.0
        {
            return None;
        }

        Some(WalletTrade {
            wallet_address: config.address.clone(),
            wallet_name: config.name.clone(),
            market_id,
            market_question,
            outcome,
            side,
            price,
            size,
            size_usd,
            timestamp,
            tx_hash,
        })
    }

    fn is_new_trade(&self, trade: &WalletTrade, wallet_address: &str) -> bool {
        let wallet_trades = self
            .trade_history
            .get(wallet_address)
            .map(|v| v.as_slice())
            .unwrap_or(&[]);

        // Check if we've seen this exact trade before
        for existing_trade in wallet_trades {
            if let (Some(tx_hash), Some(existing_tx_hash)) = (&trade.tx_hash, &existing_trade.tx_hash) {
                if tx_hash == existing_tx_hash {
                    return false;
                }
            }
            if existing_trade.market_id == trade.market_id
                && existing_trade.outcome == trade.outcome
                && existing_trade.side == trade.side
                && (existing_trade.timestamp - trade.timestamp).num_seconds().abs() < 5
            {
                return false;
            }
        }

        true
    }

    pub fn get_wallet_stats(&self, wallet_address: &str) -> Option<serde_json::Value> {
        if !self.wallet_configs.contains_key(wallet_address) {
            return None;
        }

        let trades = self.trade_history.get(wallet_address).map(|v| v.as_slice()).unwrap_or(&[]);
        if trades.is_empty() {
            return Some(json!({ "totalTrades": 0 }));
        }

        let total_trades = trades.len();
        let total_volume_usd: f64 = trades.iter().map(|t| t.size_usd).sum();
        let buy_trades = trades.iter().filter(|t| t.side == "buy").count();
        let sell_trades = trades.iter().filter(|t| t.side == "sell").count();

        Some(json!({
            "totalTrades": total_trades,
            "totalVolumeUsd": total_volume_usd,
            "buyTrades": buy_trades,
            "sellTrades": sell_trades,
            "lastTrade": trades.last().unwrap().timestamp.to_rfc3339()
        }))
    }
}

use serde_json::json;
