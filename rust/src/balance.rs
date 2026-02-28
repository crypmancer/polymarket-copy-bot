use crate::clob::ClobClient;
use anyhow::Result;
use tracing::{info, warn};

const COLLATERAL: &str = "COLLATERAL";

pub async fn get_available_balance(client: &ClobClient, token_id: Option<&str>) -> Result<f64> {
    let balance_resp = client.get_balance_allowance(COLLATERAL).await?;
    let total: f64 = balance_resp.balance.as_deref().unwrap_or("0").parse().unwrap_or(0.0);
    let orders = client.get_open_orders(token_id).await?;
    let mut reserved = 0.0;
    for order in orders {
        let side = order.side.as_deref().unwrap_or("").to_uppercase();
        if side == "BUY" {
            let orig: f64 = order.original_size.as_deref().unwrap_or("0").parse().unwrap_or(0.0);
            let matched: f64 = order.size_matched.as_deref().unwrap_or("0").parse().unwrap_or(0.0);
            reserved += orig - matched;
        }
    }
    Ok((total - reserved).max(0.0))
}

pub async fn display_wallet_balance(client: &ClobClient) -> Result<()> {
    let r = client.get_balance_allowance(COLLATERAL).await?;
    let balance: f64 = r.balance.as_deref().unwrap_or("0").parse().unwrap_or(0.0);
    let allowance: f64 = r.allowance.as_deref().unwrap_or("0").parse().unwrap_or(0.0);
    info!("═══════════════════════════════════════");
    info!("💰 WALLET BALANCE & ALLOWANCE");
    info!("═══════════════════════════════════════");
    info!("USDC Balance: {:.6}", balance);
    info!("USDC Allowance: {:.6}", allowance);
    info!("═══════════════════════════════════════");
    Ok(())
}

pub async fn validate_buy_order_balance(client: &ClobClient, required_amount: f64) -> Result<BalanceCheck> {
    let r = client.get_balance_allowance(COLLATERAL).await?;
    let balance: f64 = r.balance.as_deref().unwrap_or("0").parse().unwrap_or(0.0);
    let allowance: f64 = r.allowance.as_deref().unwrap_or("0").parse().unwrap_or(0.0);
    let available = get_available_balance(client, None).await?;
    let valid = available >= required_amount;
    if !valid {
        warn!("Insufficient balance: required={:.6} available={:.6}", required_amount, available);
    }
    Ok(BalanceCheck {
        valid,
        available,
        required: required_amount,
        balance,
        allowance: Some(allowance),
    })
}

pub struct BalanceCheck {
    pub valid: bool,
    pub available: f64,
    pub required: f64,
    pub balance: f64,
    pub allowance: Option<f64>,
}
