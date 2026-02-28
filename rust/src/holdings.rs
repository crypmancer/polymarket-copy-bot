use anyhow::Result;
use std::collections::HashMap;
use std::path::Path;
use tracing::{error, info, warn};

pub type TokenHoldings = HashMap<String, HashMap<String, f64>>;

fn load_holdings(path: &Path) -> TokenHoldings {
    if !path.exists() {
        return TokenHoldings::new();
    }
    match std::fs::read_to_string(path) {
        Ok(s) => serde_json::from_str(&s).unwrap_or_else(|_| TokenHoldings::new()),
        Err(e) => {
            error!("Failed to load holdings: {}", e);
            TokenHoldings::new()
        }
    }
}

fn save_holdings(path: &Path, holdings: &TokenHoldings) -> Result<()> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    std::fs::write(path, serde_json::to_string_pretty(holdings)?)?;
    Ok(())
}

pub fn add_holdings(path: &Path, market_id: &str, token_id: &str, amount: f64) -> Result<()> {
    let mut holdings = load_holdings(path);
    holdings
        .entry(market_id.to_string())
        .or_default()
        .entry(token_id.to_string())
        .and_modify(|a| *a += amount)
        .or_insert(amount);
    save_holdings(path, &holdings)?;
    info!("Added {} tokens to holdings: {} -> {}", amount, market_id, &token_id[..token_id.len().min(20)]);
    Ok(())
}

pub fn get_holdings(path: &Path, market_id: &str, token_id: &str) -> f64 {
    load_holdings(path)
        .get(market_id)
        .and_then(|m| m.get(token_id))
        .copied()
        .unwrap_or(0.0)
}

pub fn remove_holdings(path: &Path, market_id: &str, token_id: &str, amount: f64) -> Result<()> {
    let mut holdings = load_holdings(path);
    if let Some(tokens) = holdings.get_mut(market_id) {
        if let Some(current) = tokens.get_mut(token_id) {
            *current -= amount;
            if *current <= 0.0 {
                tokens.remove(token_id);
            }
            if tokens.is_empty() {
                holdings.remove(market_id);
            }
            save_holdings(path, &holdings)?;
            info!("Removed {} tokens from holdings: {} -> {}", amount, market_id, &token_id[..token_id.len().min(20)]);
            return Ok(());
        }
    }
    warn!("No holdings found for {} -> {}", market_id, &token_id[..token_id.len().min(20)]);
    Ok(())
}

pub fn get_all_holdings(path: &Path) -> TokenHoldings {
    load_holdings(path)
}

pub fn clear_market_holdings(path: &Path, market_id: &str) -> Result<()> {
    let mut holdings = load_holdings(path);
    if holdings.remove(market_id).is_some() {
        save_holdings(path, &holdings)?;
        info!("Cleared holdings for market: {}", market_id);
    } else {
        warn!("No holdings found for market: {}", market_id);
    }
    Ok(())
}
