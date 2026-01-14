use crate::config::ArbitrageConfig;
use crate::polymarket_client::PolymarketClient;
use chrono::{DateTime, Utc};
use std::collections::HashMap;

#[derive(Debug, Clone)]
pub struct ArbitrageOpportunity {
    pub market_id: String,
    pub market_question: String,
    pub opportunity_type: String,
    pub yes_price: f64,
    pub no_price: f64,
    pub total_cost: f64,
    pub profit_pct: f64,
    pub profit_usd: f64,
    pub liquidity_yes: f64,
    pub liquidity_no: f64,
    pub timestamp: DateTime<Utc>,
    pub expiry_time: Option<DateTime<Utc>>,
}

pub struct ArbitrageDetector {
    config: ArbitrageConfig,
    pm_client: std::sync::Arc<PolymarketClient>,
    active_opportunities: HashMap<String, ArbitrageOpportunity>,
}

impl ArbitrageDetector {
    pub fn new(config: ArbitrageConfig, polymarket_client: std::sync::Arc<PolymarketClient>) -> Self {
        Self {
            config,
            pm_client: polymarket_client,
            active_opportunities: HashMap::new(),
        }
    }

    pub async fn scan_market(&mut self, market_id: &str) -> Option<ArbitrageOpportunity> {
        // Get market order book
        let order_book = self.pm_client.get_order_book(market_id).await?;

        // Check internal arbitrage (YES + NO < $1)
        if self.config.internal_arb_enabled {
            if let Some(opp) = self.detect_internal_arbitrage(market_id, &order_book).await {
                if self.is_valid(&opp) {
                    return Some(opp);
                }
            }
        }

        // Check cross-platform arbitrage (if enabled)
        if self.config.cross_platform_enabled {
            if let Some(opp) = self.detect_cross_platform_arbitrage(market_id, &order_book).await {
                if self.is_valid(&opp) {
                    return Some(opp);
                }
            }
        }

        None
    }

    async fn detect_internal_arbitrage(
        &self,
        market_id: &str,
        order_book: &serde_json::Value,
    ) -> Option<ArbitrageOpportunity> {
        let yes_best_ask = self.get_best_ask(order_book, "YES")?;
        let no_best_ask = self.get_best_ask(order_book, "NO")?;

        let yes_price = yes_best_ask.get("price")?.as_str()?.parse::<f64>().ok()?;
        let no_price = no_best_ask.get("price")?.as_str()?.parse::<f64>().ok()?;
        let total_cost = yes_price + no_price;

        // Arbitrage exists if total < $1 (accounting for fees)
        let fee_adjusted_cost = total_cost * 1.01; // Assume 1% fees

        if fee_adjusted_cost < 0.99 {
            // Minimum 1% profit after fees
            let profit_pct = (1.0 - fee_adjusted_cost) / fee_adjusted_cost;

            // Calculate available liquidity
            let liquidity_yes = yes_best_ask
                .get("size")
                .and_then(|v| v.as_f64())
                .unwrap_or(0.0)
                * yes_price;
            let liquidity_no = no_best_ask
                .get("size")
                .and_then(|v| v.as_f64())
                .unwrap_or(0.0)
                * no_price;

            // Calculate profit for $1 investment
            let profit_usd = profit_pct * 1.0;

            let market_info = order_book.get("market").or_else(|| order_book.get("marketInfo"));

            Some(ArbitrageOpportunity {
                market_id: market_id.to_string(),
                market_question: market_info
                    .and_then(|m| m.get("question"))
                    .and_then(|v| v.as_str())
                    .unwrap_or(market_id)
                    .to_string(),
                opportunity_type: "internal".to_string(),
                yes_price,
                no_price,
                total_cost,
                profit_pct,
                profit_usd,
                liquidity_yes,
                liquidity_no,
                timestamp: Utc::now(),
                expiry_time: None,
            })
        } else {
            None
        }
    }

    async fn detect_cross_platform_arbitrage(
        &self,
        _market_id: &str,
        _order_book: &serde_json::Value,
    ) -> Option<ArbitrageOpportunity> {
        // TODO: Implement cross-platform detection
        // This would require:
        // 1. Kalshi API integration
        // 2. Market matching logic (same event on both platforms)
        // 3. Price comparison and profit calculation
        None
    }

    fn get_best_ask(&self, order_book: &serde_json::Value, outcome: &str) -> Option<serde_json::Value> {
        let outcomes = order_book.get("outcomes")?;
        let outcome_data = outcomes.get(outcome)?;
        let asks = outcome_data.get("asks")?.as_array()?;

        if asks.is_empty() {
            return None;
        }

        // Sort by price (ascending) and get best (lowest) ask
        let mut sorted_asks = asks.clone();
        sorted_asks.sort_by(|a, b| {
            let price_a = a.get("price").and_then(|v| v.as_str()).and_then(|s| s.parse::<f64>().ok()).unwrap_or(0.0);
            let price_b = b.get("price").and_then(|v| v.as_str()).and_then(|s| s.parse::<f64>().ok()).unwrap_or(0.0);
            price_a.partial_cmp(&price_b).unwrap_or(std::cmp::Ordering::Equal)
        });

        sorted_asks.first().cloned()
    }

    pub async fn scan_markets(&mut self, market_ids: &[String]) -> Vec<ArbitrageOpportunity> {
        let mut opportunities = Vec::new();

        for market_id in market_ids {
            if let Some(opp) = self.scan_market(market_id).await {
                opportunities.push(opp.clone());
                self.active_opportunities.insert(market_id.clone(), opp);
            }
        }

        opportunities
    }

    pub fn get_opportunity(&self, market_id: &str) -> Option<ArbitrageOpportunity> {
        self.active_opportunities.get(market_id).cloned()
    }

    pub fn has_opportunity(&self, market_id: &str) -> bool {
        self.active_opportunities
            .get(market_id)
            .map(|opp| self.is_valid(opp))
            .unwrap_or(false)
    }

    fn is_valid(&self, opp: &ArbitrageOpportunity) -> bool {
        if opp.profit_pct < self.config.min_arb_profit_pct {
            return false;
        }
        if opp.profit_pct > self.config.max_arb_profit_pct {
            return false;
        }
        if opp.liquidity_yes < self.config.min_liquidity_usd {
            return false;
        }
        if opp.liquidity_no < self.config.min_liquidity_usd {
            return false;
        }
        true
    }
}
