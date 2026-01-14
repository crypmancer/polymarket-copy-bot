use crate::arbitrage_detector::ArbitrageDetector;
use crate::config::{load_config, BotConfig};
use crate::copy_trader::CopyTrader;
use crate::order_executor::OrderExecutor;
use crate::polymarket_client::PolymarketClient;
use crate::risk_manager::RiskManager;
use crate::wallet_monitor::{WalletMonitor, WalletTrade};
use std::collections::HashMap;
use std::sync::Arc;

pub struct PolymarketArbCopyBot {
    config: BotConfig,
    pm_client: Option<Arc<PolymarketClient>>,
    arb_detector: Option<Arc<tokio::sync::RwLock<ArbitrageDetector>>>,
    wallet_monitor: Option<Arc<WalletMonitor>>,
    copy_traders: Arc<tokio::sync::RwLock<HashMap<String, Arc<tokio::sync::Mutex<CopyTrader>>>>>,
    risk_manager: Option<Arc<tokio::sync::RwLock<RiskManager>>>,
    order_executor: Option<Arc<tokio::sync::RwLock<OrderExecutor>>>,
    running: Arc<tokio::sync::RwLock<bool>>,
}

impl PolymarketArbCopyBot {
    pub fn new(config: BotConfig) -> Self {
        Self {
            config,
            pm_client: None,
            arb_detector: None,
            wallet_monitor: None,
            copy_traders: Arc::new(tokio::sync::RwLock::new(HashMap::new())),
            risk_manager: None,
            order_executor: None,
            running: Arc::new(tokio::sync::RwLock::new(false)),
        }
    }

    pub async fn initialize(&mut self) -> Result<(), Box<dyn std::error::Error>> {
        log::info!("Initializing Polymarket Arbitrage + Copy Trading Bot...");

        // Get wallet addresses for on-chain monitoring
        let wallet_addresses: Vec<String> = self
            .config
            .wallets
            .iter()
            .filter(|w| w.enabled)
            .map(|w| w.address.clone())
            .collect();

        // Initialize Polymarket client
        let pm_client = Arc::new(PolymarketClient::new(
            self.config.polymarket.clone(),
            wallet_addresses.clone(),
        ));
        self.pm_client = Some(pm_client.clone());

        // Initialize risk manager
        let risk_manager = Arc::new(tokio::sync::RwLock::new(RiskManager::new(
            self.config.risk.clone(),
        )));
        self.risk_manager = Some(risk_manager.clone());

        // Initialize order executor
        let order_executor = Arc::new(tokio::sync::RwLock::new(OrderExecutor::new(
            pm_client.clone(),
        )));
        self.order_executor = Some(order_executor.clone());

        // Initialize arbitrage detector
        let arb_detector = Arc::new(tokio::sync::RwLock::new(ArbitrageDetector::new(
            self.config.arbitrage.clone(),
            pm_client.clone(),
        )));
        self.arb_detector = Some(arb_detector.clone());

        // Initialize copy traders for each wallet
        let mut copy_traders_map = HashMap::new();
        for wallet_config in &self.config.wallets {
            let copy_trader = CopyTrader::new(
                arb_detector.clone(),
                risk_manager.clone(),
                order_executor.clone(),
                wallet_config.clone(),
            );
            copy_traders_map.insert(
                wallet_config.address.clone(),
                Arc::new(tokio::sync::Mutex::new(copy_trader)),
            );
        }
        *self.copy_traders.write().await = copy_traders_map;

        log::info!("Bot initialization complete");
        Ok(())
    }

    async fn handle_wallet_trade(&self, trade: WalletTrade) {
        let copy_traders = self.copy_traders.read().await;
        if let Some(copy_trader) = copy_traders.get(&trade.wallet_address) {
            let mut trader = copy_trader.lock().await;
            trader.process_trade(trade).await;
        } else {
            log::warn!(
                "No copy trader configured for wallet {}",
                trade.wallet_address
            );
        }
    }

    pub async fn start(&mut self) -> Result<(), Box<dyn std::error::Error>> {
        self.initialize().await?;
        *self.running.write().await = true;

        log::info!("Starting bot...");
        log::info!("Monitoring {} wallets", self.config.wallets.len());
        log::info!(
            "Arbitrage detection: {}",
            if self.config.arbitrage.internal_arb_enabled {
                "enabled"
            } else {
                "disabled"
            }
        );

        // Start wallet monitoring
        // Start arbitrage scanning
        // Start status reporting
        // These would run in parallel using tokio::spawn

        Ok(())
    }

    pub async fn stop(&self) {
        log::info!("Stopping bot...");
        *self.running.write().await = false;

        if let Some(pm_client) = &self.pm_client {
            pm_client.close_web_socket();
        }

        log::info!("Bot stopped");
    }
}
