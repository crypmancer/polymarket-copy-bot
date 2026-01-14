use crate::config::PolymarketConfig;
use anyhow::Result;
use serde_json::{json, Value};
use std::sync::Arc;
use tokio::time::{sleep, Duration};

pub struct PolymarketClient {
    config: PolymarketConfig,
    clob_client: reqwest::Client,
    gamma_client: reqwest::Client,
    data_client: reqwest::Client,
}

impl PolymarketClient {
    pub fn new(config: PolymarketConfig, _wallet_addresses: Vec<String>) -> Self {
        let mut clob_client_builder = reqwest::Client::builder()
            .timeout(Duration::from_secs(10))
            .build()
            .unwrap();

        let mut gamma_client_builder = reqwest::Client::builder()
            .timeout(Duration::from_secs(10))
            .build()
            .unwrap();

        let mut data_client_builder = reqwest::Client::builder()
            .timeout(Duration::from_secs(10))
            .build()
            .unwrap();

        // Create clients
        let clob_client = clob_client_builder;
        let gamma_client = gamma_client_builder;
        let data_client = data_client_builder;

        Self {
            config,
            clob_client,
            gamma_client,
            data_client,
        }
    }

    pub async fn get_markets(&self, active: bool, limit: usize, offset: usize) -> Vec<Value> {
        let params = [
            ("active", active.to_string()),
            ("limit", limit.to_string()),
            ("offset", offset.to_string()),
        ];

        match self
            .gamma_client
            .get(&format!("{}/markets", self.config.gamma_api_url))
            .query(&params)
            .send()
            .await
        {
            Ok(response) => {
                if let Ok(data) = response.json::<Value>().await {
                    if let Some(data_array) = data.get("data").and_then(|v| v.as_array()) {
                        return data_array.clone();
                    }
                    if let Some(data_array) = data.as_array() {
                        return data_array.clone();
                    }
                }
            }
            Err(e) => {
                log::error!("Error fetching markets: {}", e);
            }
        }
        Vec::new()
    }

    pub async fn get_market(&self, market_id: &str) -> Option<Value> {
        match self
            .gamma_client
            .get(&format!("{}/markets/{}", self.config.gamma_api_url, market_id))
            .send()
            .await
        {
            Ok(response) => {
                if let Ok(data) = response.json::<Value>().await {
                    return data.get("data").cloned().or(Some(data));
                }
            }
            Err(e) => {
                log::error!("Error fetching market {}: {}", market_id, e);
            }
        }
        None
    }

    pub async fn get_order_book(&self, market_id: &str) -> Option<Value> {
        let params = [("market", market_id)];

        match self
            .clob_client
            .get(&format!("{}/book", self.config.clob_api_url))
            .query(&params)
            .send()
            .await
        {
            Ok(response) => {
                if let Ok(data) = response.json::<Value>().await {
                    return Some(self.transform_order_book(data, market_id));
                }
            }
            Err(e) => {
                log::debug!("Error fetching order book for {}: {}", market_id, e);
            }
        }
        None
    }

    fn transform_order_book(&self, book_data: Value, market_id: &str) -> Value {
        let mut transformed = json!({
            "marketId": market_id,
            "outcomes": {}
        });

        // Extract YES and NO outcomes
        for outcome in &["YES", "NO"] {
            let outcome_key = outcome.to_lowercase();
            if let Some(outcome_data) = book_data.get(&outcome_key) {
                transformed["outcomes"][outcome] = json!({
                    "asks": outcome_data.get("asks").unwrap_or(&json!([])),
                    "bids": outcome_data.get("bids").unwrap_or(&json!([]))
                });
            }
        }

        // Add market info if available
        if let Some(market) = book_data.get("market") {
            transformed["market"] = market.clone();
        }

        transformed
    }

    pub async fn get_wallet_positions(&self, wallet_address: &str) -> Vec<Value> {
        let params = [("user", wallet_address.to_lowercase())];

        match self
            .data_client
            .get(&format!("{}/positions", self.config.data_api_url))
            .query(&params)
            .send()
            .await
        {
            Ok(response) => {
                if response.status() == 400 {
                    // Expected when auth is required
                    return Vec::new();
                }

                if let Ok(data) = response.json::<Value>().await {
                    if let Some(data_array) = data.get("data").and_then(|v| v.as_array()) {
                        return data_array.clone();
                    }
                    if let Some(data_array) = data.as_array() {
                        return data_array.clone();
                    }
                }
            }
            Err(_) => {
                // Suppress errors for 400 status
            }
        }
        Vec::new()
    }

    pub async fn get_wallet_trades(
        &self,
        wallet_address: &str,
        _since: Option<chrono::DateTime<chrono::Utc>>,
        _limit: usize,
    ) -> Vec<Value> {
        // Try positions first (most reliable method)
        let positions = self.get_wallet_positions(wallet_address).await;
        if !positions.is_empty() {
            return self.transform_positions_to_trades(&positions, wallet_address);
        }

        // Try activity endpoint
        let params = [("address", wallet_address.to_lowercase())];

        match self
            .data_client
            .get(&format!("{}/activity", self.config.data_api_url))
            .query(&params)
            .send()
            .await
        {
            Ok(response) => {
                if response.status() == 400 {
                    return Vec::new();
                }

                if let Ok(data) = response.json::<Value>().await {
                    if let Some(data_array) = data.get("data").and_then(|v| v.as_array()) {
                        return self.transform_api_trades(data_array);
                    }
                    if let Some(data_array) = data.as_array() {
                        return self.transform_api_trades(data_array);
                    }
                }
            }
            Err(_) => {
                // Suppress errors
            }
        }

        Vec::new()
    }

    fn transform_positions_to_trades(&self, positions: &[Value], _wallet_address: &str) -> Vec<Value> {
        positions
            .iter()
            .map(|position| {
                json!({
                    "market": position.get("market").or_else(|| {
                        position.get("marketId").map(|id| json!({"id": id}))
                    }),
                    "marketId": position.get("marketId").or_else(|| {
                        position.get("market").and_then(|m| m.get("id"))
                    }),
                    "question": position.get("question").or_else(|| {
                        position.get("market").and_then(|m| m.get("question"))
                    }),
                    "outcome": position.get("outcome").or_else(|| {
                        position.get("side").map(|s| s.as_str().unwrap_or("YES").to_uppercase())
                    }),
                    "side": "buy",
                    "price": position.get("price").or_else(|| {
                        position.get("avgPrice").or_else(|| position.get("pricePerShare"))
                    }),
                    "size": position.get("size").or_else(|| {
                        position.get("amount").or_else(|| position.get("quantity"))
                    }),
                    "timestamp": position.get("createdAt").or_else(|| {
                        position.get("timestamp").or_else(|| position.get("openedAt"))
                    }),
                    "txHash": position.get("txHash").or_else(|| position.get("transactionHash")),
                    "positionId": position.get("id").or_else(|| position.get("positionId")),
                    "balance": position.get("balance").or_else(|| position.get("amount"))
                })
            })
            .collect()
    }

    fn transform_api_trades(&self, api_trades: &[Value]) -> Vec<Value> {
        api_trades
            .iter()
            .map(|trade| {
                json!({
                    "market": trade.get("market").or_else(|| {
                        trade.get("marketId").map(|id| json!({"id": id}))
                    }),
                    "marketId": trade.get("marketId").or_else(|| {
                        trade.get("market").and_then(|m| m.get("id"))
                    }),
                    "question": trade.get("question").or_else(|| {
                        trade.get("market").and_then(|m| m.get("question"))
                    }),
                    "outcome": trade.get("outcome").or_else(|| {
                        trade.get("side").map(|s| s.as_str().unwrap_or("YES").to_uppercase())
                    }),
                    "side": trade.get("side").map(|s| s.as_str().unwrap_or("buy").to_lowercase()).unwrap_or_else(|| "buy".to_string()),
                    "price": trade.get("price").or_else(|| trade.get("pricePerShare")),
                    "size": trade.get("size").or_else(|| trade.get("amount")),
                    "timestamp": trade.get("timestamp").or_else(|| {
                        trade.get("createdAt").or_else(|| trade.get("time"))
                    }),
                    "txHash": trade.get("txHash").or_else(|| {
                        trade.get("transactionHash").or_else(|| trade.get("hash"))
                    })
                })
            })
            .collect()
    }

    pub async fn place_order(
        &self,
        market_id: &str,
        outcome: &str,
        side: &str,
        price: f64,
        size: f64,
    ) -> Option<Value> {
        let order_data = json!({
            "market": market_id,
            "outcome": outcome,
            "side": side.to_uppercase(),
            "price": price.to_string(),
            "size": size.to_string(),
            "type": "LIMIT"
        });

        match self
            .clob_client
            .post(&format!("{}/order", self.config.clob_api_url))
            .json(&order_data)
            .send()
            .await
        {
            Ok(response) => {
                if let Ok(data) = response.json::<Value>().await {
                    return data.get("data").cloned().or(Some(data));
                }
            }
            Err(e) => {
                log::error!("Error placing order: {}", e);
                if let Ok(response) = e.response() {
                    log::error!("API response: {:?}", response);
                }
            }
        }
        None
    }

    pub async fn cancel_order(&self, order_id: &str) -> bool {
        let order_data = json!({ "orderId": order_id });

        match self
            .clob_client
            .delete(&format!("{}/order", self.config.clob_api_url))
            .json(&order_data)
            .send()
            .await
        {
            Ok(response) => response.status().is_success(),
            Err(e) => {
                log::error!("Error canceling order {}: {}", order_id, e);
                false
            }
        }
    }

    pub fn close_web_socket(&self) {
        // WebSocket closure handled separately if needed
        log::debug!("WebSocket connection closed");
    }
}
