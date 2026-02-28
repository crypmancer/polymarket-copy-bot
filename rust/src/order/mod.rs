use crate::balance::{display_wallet_balance, validate_buy_order_balance};
use crate::chain::approve_tokens_after_buy;
use crate::clob::ClobClient;
use crate::feed::TradePayload;
use crate::holdings::{add_holdings, get_holdings, remove_holdings};
use anyhow::Result;
use ethers::prelude::*;
use tracing::{info, warn};

#[derive(Debug)]
pub struct CopyTradeResult {
    pub success: bool,
    pub order_id: Option<String>,
    pub transaction_hashes: Option<Vec<String>>,
    pub error: Option<String>,
}

pub struct TradeOrderBuilder {
    clob: ClobClient,
    provider: Provider<Http>,
    wallet: LocalWallet,
    chain_id: u64,
    holdings_path: std::path::PathBuf,
    tick_size: String,
    neg_risk: bool,
    order_type: String,
}

impl TradeOrderBuilder {
    pub fn new(
        clob: ClobClient,
        provider: Provider<Http>,
        wallet: LocalWallet,
        chain_id: u64,
        holdings_path: std::path::PathBuf,
        tick_size: String,
        neg_risk: bool,
        order_type: String,
    ) -> Self {
        Self {
            clob,
            provider,
            wallet,
            chain_id,
            holdings_path,
            tick_size,
            neg_risk,
            order_type,
        }
    }

    pub async fn copy_trade(
        &self,
        trade: &TradePayload,
        size_multiplier: f64,
        max_amount: Option<f64>,
    ) -> Result<CopyTradeResult> {
        let condition_id = trade.condition_id().unwrap_or("");
        let token_id = &trade.asset;
        let side_upper = trade.side.to_uppercase();

        if side_upper == "SELL" {
            let holdings_amount = get_holdings(&self.holdings_path, condition_id, token_id);
            if holdings_amount <= 0.0 {
                warn!("No holdings for SELL: {} {}", condition_id, &token_id[..token_id.len().min(20)]);
                return Ok(CopyTradeResult {
                    success: false,
                    order_id: None,
                    transaction_hashes: None,
                    error: Some("No holdings available to sell".to_string()),
                });
            }
            return self.place_market_sell(condition_id, token_id, holdings_amount).await;
        }

        let amount = (trade.price * trade.size * size_multiplier).max(1.0);
        let amount = if let Some(max) = max_amount {
            if amount > max {
                (max * 0.5).min(max)
            } else {
                amount
            }
        } else {
            amount
        };

        let _ = self.clob.update_balance_allowance("COLLATERAL").await;
        let _ = display_wallet_balance(&self.clob).await;
        let check = validate_buy_order_balance(&self.clob, amount).await?;
        let amount = if !check.valid {
            if check.available <= 0.0 {
                return Ok(CopyTradeResult {
                    success: false,
                    order_id: None,
                    transaction_hashes: None,
                    error: Some(format!("Insufficient USDC. Available: {}", check.available)),
                });
            }
            check.available
        } else {
            amount
        };

        let result = self.place_market_buy(token_id, amount, trade.price).await?;
        if result.success {
            if let Some(taking) = result.transaction_hashes.as_ref() {
                if !taking.is_empty() {}
            }
            let tokens_est = amount / trade.price;
            add_holdings(&self.holdings_path, condition_id, token_id, tokens_est)?;
            let _ = approve_tokens_after_buy(&self.provider, &self.wallet, self.chain_id, self.neg_risk).await;
        }
        Ok(result)
    }

    async fn place_market_buy(&self, token_id: &str, amount: f64, price: f64) -> Result<CopyTradeResult> {
        let order_payload = self.build_market_order_payload(token_id, "BUY", amount, price);
        self.post_market_order(order_payload).await
    }

    async fn place_market_sell(&self, condition_id: &str, token_id: &str, amount: f64) -> Result<CopyTradeResult> {
        let order_payload = self.build_market_order_payload(token_id, "SELL", amount, 0.5);
        let result = self.post_market_order(order_payload).await?;
        if result.success {
            remove_holdings(&self.holdings_path, condition_id, token_id, amount)?;
        }
        Ok(result)
    }

    fn build_market_order_payload(&self, token_id: &str, side: &str, amount: f64, price: f64) -> serde_json::Value {
        serde_json::json!({
            "tokenID": token_id,
            "side": side,
            "amount": amount,
            "price": price,
            "orderType": self.order_type,
            "tickSize": self.tick_size,
            "negRisk": self.neg_risk
        })
    }

    async fn post_market_order(&self, _order: serde_json::Value) -> Result<CopyTradeResult> {
        info!("Placeholder: market order would be sent to CLOB (full EIP-712 order signing not yet implemented in Rust)");
        Ok(CopyTradeResult {
            success: false,
            order_id: None,
            transaction_hashes: None,
            error: Some("Rust CLOB market order posting not yet implemented - use TS bot for execution".to_string()),
        })
    }
}
