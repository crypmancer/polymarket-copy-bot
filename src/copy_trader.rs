use crate::arbitrage_detector::ArbitrageDetector;
use crate::config::WalletConfig;
use crate::order_executor::OrderExecutor;
use crate::risk_manager::RiskManager;
use crate::wallet_monitor::WalletTrade;
use chrono::Utc;
use std::collections::HashMap;

pub struct CopyTrader {
    arb_detector: std::sync::Arc<tokio::sync::RwLock<ArbitrageDetector>>,
    risk_manager: std::sync::Arc<tokio::sync::RwLock<RiskManager>>,
    order_executor: std::sync::Arc<tokio::sync::RwLock<OrderExecutor>>,
    config: WalletConfig,
    copied_trades: HashMap<String, chrono::DateTime<chrono::Utc>>,
}

impl CopyTrader {
    pub fn new(
        arbitrage_detector: std::sync::Arc<tokio::sync::RwLock<ArbitrageDetector>>,
        risk_manager: std::sync::Arc<tokio::sync::RwLock<RiskManager>>,
        order_executor: std::sync::Arc<tokio::sync::RwLock<OrderExecutor>>,
        config: WalletConfig,
    ) -> Self {
        Self {
            arb_detector: arbitrage_detector,
            risk_manager: risk_manager,
            order_executor: order_executor,
            config,
            copied_trades: HashMap::new(),
        }
    }

    pub async fn process_trade(&mut self, trade: WalletTrade) -> bool {
        // Skip if we've already copied this trade
        let trade_key = format!(
            "{}_{}_{}_{}",
            trade.tx_hash.as_ref().unwrap_or(&"".to_string()),
            trade.market_id,
            trade.outcome,
            trade.side
        );

        if self.copied_trades.contains_key(&trade_key) {
            log::debug!("Skipping already copied trade: {}", trade_key);
            return false;
        }

        // Check if wallet meets minimum requirements
        if !self.should_copy_wallet(&trade) {
            log::debug!(
                "Skipping trade from {} - doesn't meet criteria",
                trade.wallet_name
            );
            return false;
        }

        // Check market filter
        if let Some(ref markets_filter) = self.config.markets_filter {
            if !markets_filter.contains(&trade.market_id) {
                log::debug!("Skipping trade - market {} not in filter", trade.market_id);
                return false;
            }
        }

        // Check arbitrage signal if required
        if self.config.require_arb_signal {
            let has_arb = {
                let detector = self.arb_detector.read().await;
                detector.has_opportunity(&trade.market_id)
            };

            if !has_arb {
                log::debug!(
                    "Skipping trade - no arbitrage signal for market {}",
                    trade.market_id
                );
                return false;
            }

            let arb_opp = {
                let detector = self.arb_detector.read().await;
                detector.get_opportunity(&trade.market_id)
            };

            if let Some(opp) = arb_opp {
                log::info!(
                    "Arbitrage opportunity detected: {:.2}% profit for market {}",
                    opp.profit_pct * 100.0,
                    opp.market_question
                );
            }
        }

        // Calculate position size
        let position_size_usd = self.calculate_position_size(&trade);
        if position_size_usd <= 0.0 {
            log::debug!("Skipping trade - position size too small: {}", position_size_usd);
            return false;
        }

        // Check risk limits
        let can_open = {
            let risk_mgr = self.risk_manager.read().await;
            risk_mgr.can_open_position(&trade.market_id, position_size_usd)
        };

        if !can_open {
            log::warn!(
                "Cannot copy trade - risk limits exceeded for market {}",
                trade.market_id
            );
            return false;
        }

        // Execute the copy trade
        let success = self.execute_copy_trade(&trade, position_size_usd).await;

        if success {
            self.copied_trades.insert(trade_key, Utc::now());
            log::info!(
                "Successfully copied trade from {}: {} {:.2} USD of {} @ {:.4}",
                trade.wallet_name,
                trade.side,
                position_size_usd,
                trade.outcome,
                trade.price
            );
            true
        } else {
            log::error!("Failed to execute copy trade from {}", trade.wallet_name);
            false
        }
    }

    fn should_copy_wallet(&self, _trade: &WalletTrade) -> bool {
        // This could be extended with win rate checks, performance metrics, etc.
        self.config.enabled
    }

    fn calculate_position_size(&self, trade: &WalletTrade) -> f64 {
        let base_size = trade.size_usd;
        let scaled_size = base_size * self.config.position_size_multiplier;
        let final_size = scaled_size.min(self.config.max_position_size_usd);

        // Ensure minimum viable size (e.g., $10)
        if final_size < 10.0 {
            return 0.0;
        }

        final_size
    }

    async fn execute_copy_trade(&self, trade: &WalletTrade, position_size_usd: f64) -> bool {
        // Calculate number of shares to buy
        let shares = position_size_usd / trade.price;

        // If this is an arbitrage opportunity, we might want to buy both sides
        if self.config.require_arb_signal {
            let arb_opp = {
                let detector = self.arb_detector.read().await;
                detector.get_opportunity(&trade.market_id)
            };

            if let Some(opp) = arb_opp {
                if opp.opportunity_type == "internal" {
                    // For internal arbitrage, buy both YES and NO
                    return self.execute_arbitrage_trade(&opp, position_size_usd).await;
                }
            }
        }

        // Regular directional copy trade
        let order_result = {
            let mut executor = self.order_executor.write().await;
            executor
                .place_order(
                    &trade.market_id,
                    &trade.outcome,
                    &trade.side,
                    trade.price,
                    shares,
                )
                .await
        };

        if let Some(_order) = order_result {
            // Update risk manager
            let mut risk_mgr = self.risk_manager.write().await;
            risk_mgr.record_position(
                trade.market_id.clone(),
                position_size_usd,
                trade.outcome.clone(),
                trade.side.clone(),
                Some(trade.price),
            );
            true
        } else {
            false
        }
    }

    async fn execute_arbitrage_trade(
        &self,
        arb_opp: &crate::arbitrage_detector::ArbitrageOpportunity,
        position_size_usd: f64,
    ) -> bool {
        // Split position between YES and NO
        let yes_size_usd = position_size_usd * 0.5;
        let no_size_usd = position_size_usd * 0.5;

        // Calculate shares
        let yes_shares = yes_size_usd / arb_opp.yes_price;
        let no_shares = no_size_usd / arb_opp.no_price;

        // Place both orders
        let yes_order = {
            let mut executor = self.order_executor.write().await;
            executor
                .place_order(&arb_opp.market_id, "YES", "buy", arb_opp.yes_price, yes_shares)
                .await
        };

        let no_order = {
            let mut executor = self.order_executor.write().await;
            executor
                .place_order(&arb_opp.market_id, "NO", "buy", arb_opp.no_price, no_shares)
                .await
        };

        if yes_order.is_some() && no_order.is_some() {
            // Update risk manager for both positions
            let mut risk_mgr = self.risk_manager.write().await;
            risk_mgr.record_position(
                arb_opp.market_id.clone(),
                yes_size_usd,
                "YES".to_string(),
                "buy".to_string(),
                Some(arb_opp.yes_price),
            );
            risk_mgr.record_position(
                arb_opp.market_id.clone(),
                no_size_usd,
                "NO".to_string(),
                "buy".to_string(),
                Some(arb_opp.no_price),
            );
            log::info!(
                "Executed arbitrage trade: {:.2} YES + {:.2} NO for {:.2}% profit",
                yes_size_usd,
                no_size_usd,
                arb_opp.profit_pct * 100.0
            );
            true
        } else {
            // If one order failed, cancel the other
            if let Some(yes_order) = yes_order {
                let mut executor = self.order_executor.write().await;
                executor.cancel_order(&yes_order.order_id).await;
            }
            if let Some(no_order) = no_order {
                let mut executor = self.order_executor.write().await;
                executor.cancel_order(&no_order.order_id).await;
            }
            false
        }
    }
}
