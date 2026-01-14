use crate::config::RiskConfig;
use chrono::{DateTime, Utc};
use std::collections::HashMap;

#[derive(Debug, Clone)]
pub struct Position {
    pub market_id: String,
    pub outcome: String,
    pub side: String,
    pub size_usd: f64,
    pub entry_price: f64,
    pub timestamp: DateTime<Utc>,
}

#[derive(Debug, Clone)]
pub struct ExposureMetrics {
    pub total_exposure_usd: f64,
    pub daily_pnl_usd: f64,
    pub open_positions: usize,
    pub market_exposures: HashMap<String, f64>,
    pub available_exposure: f64,
}

pub struct RiskManager {
    config: RiskConfig,
    positions: HashMap<String, Vec<Position>>,
    total_exposure: f64,
    daily_pnl: f64,
    last_reset_date: DateTime<Utc>,
}

impl RiskManager {
    pub fn new(config: RiskConfig) -> Self {
        Self {
            config,
            positions: HashMap::new(),
            total_exposure: 0.0,
            daily_pnl: 0.0,
            last_reset_date: Utc::now(),
        }
    }

    pub fn can_open_position(&self, market_id: &str, size_usd: f64) -> bool {
        // Check daily loss limit
        if self.daily_pnl <= -self.config.max_daily_loss_usd {
            log::warn!(
                "Cannot open position - daily loss limit reached: {:.2}",
                self.daily_pnl
            );
            return false;
        }

        // Check total exposure limit
        let new_total_exposure = self.total_exposure + size_usd;
        if new_total_exposure > self.config.max_total_exposure_usd {
            log::warn!(
                "Cannot open position - total exposure limit would be exceeded: {:.2} > {:.2}",
                new_total_exposure,
                self.config.max_total_exposure_usd
            );
            return false;
        }

        // Check per-market position limit
        let market_positions = self.positions.get(market_id).map(|v| v.as_slice()).unwrap_or(&[]);
        let market_exposure: f64 = market_positions.iter().map(|p| p.size_usd).sum();
        let new_market_exposure = market_exposure + size_usd;

        if new_market_exposure > self.config.max_position_per_market_usd {
            log::warn!(
                "Cannot open position - market exposure limit would be exceeded: {:.2} > {:.2}",
                new_market_exposure,
                self.config.max_position_per_market_usd
            );
            return false;
        }

        true
    }

    pub fn record_position(
        &mut self,
        market_id: String,
        size_usd: f64,
        outcome: String,
        side: String,
        entry_price: Option<f64>,
    ) {
        if !self.positions.contains_key(&market_id) {
            self.positions.insert(market_id.clone(), Vec::new());
        }

        let position = Position {
            market_id: market_id.clone(),
            outcome,
            side,
            size_usd,
            entry_price: entry_price.unwrap_or(0.0),
            timestamp: Utc::now(),
        };

        self.positions.get_mut(&market_id).unwrap().push(position);
        self.total_exposure += size_usd;

        log::debug!(
            "Recorded position: {:.2} USD in market {}. Total exposure: {:.2}",
            size_usd,
            market_id,
            self.total_exposure
        );
    }

    pub fn close_position(
        &mut self,
        market_id: &str,
        outcome: &str,
        exit_price: Option<f64>,
    ) -> Option<f64> {
        let positions = self.positions.get_mut(market_id)?;

        // Find matching position
        let matching_index = positions
            .iter()
            .position(|p| p.outcome == outcome && p.side == "buy")?;

        let position = positions.remove(matching_index);

        // Calculate PnL
        let mut pnl = 0.0;
        if let Some(exit_price) = exit_price {
            if position.entry_price > 0.0 {
                pnl = (exit_price - position.entry_price) * position.size_usd / position.entry_price;
            }
        }

        self.total_exposure -= position.size_usd;
        self.daily_pnl += pnl;

        log::info!(
            "Closed position: {:.2} USD {} in market {}. PnL: {:.2}. Daily PnL: {:.2}",
            position.size_usd,
            position.outcome,
            market_id,
            pnl,
            self.daily_pnl
        );

        Some(pnl)
    }

    pub fn get_exposure(&mut self) -> ExposureMetrics {
        // Reset daily PnL if new day
        let current_date = Utc::now().date_naive();
        let last_reset_date = self.last_reset_date.date_naive();
        if current_date != last_reset_date {
            self.daily_pnl = 0.0;
            self.last_reset_date = Utc::now();
        }

        let mut market_exposures = HashMap::new();
        for (market_id, positions) in &self.positions {
            let exposure: f64 = positions.iter().map(|p| p.size_usd).sum();
            market_exposures.insert(market_id.clone(), exposure);
        }

        ExposureMetrics {
            total_exposure_usd: self.total_exposure,
            daily_pnl_usd: self.daily_pnl,
            open_positions: self
                .positions
                .values()
                .map(|v| v.len())
                .sum(),
            market_exposures,
            available_exposure: self.config.max_total_exposure_usd - self.total_exposure,
        }
    }

    pub fn should_hedge(&self, market_id: &str) -> bool {
        if !self.config.enable_auto_hedge {
            return false;
        }

        let positions = self.positions.get(market_id).map(|v| v.as_slice()).unwrap_or(&[]);
        if positions.len() < 2 {
            return false;
        }

        // Check if we have unbalanced exposure
        let yes_exposure: f64 = positions
            .iter()
            .filter(|p| p.outcome == "YES")
            .map(|p| p.size_usd)
            .sum();

        let no_exposure: f64 = positions
            .iter()
            .filter(|p| p.outcome == "NO")
            .map(|p| p.size_usd)
            .sum();

        let total_exposure = yes_exposure + no_exposure;
        if total_exposure == 0.0 {
            return false;
        }

        let imbalance = (yes_exposure - no_exposure).abs() / total_exposure;
        imbalance > 0.2 // More than 20% imbalance
    }
}
