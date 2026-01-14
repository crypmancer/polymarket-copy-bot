use crate::polymarket_client::PolymarketClient;
use std::collections::HashMap;

#[derive(Debug, Clone)]
pub struct Order {
    pub order_id: String,
    pub market_id: String,
    pub outcome: String,
    pub side: String,
    pub price: f64,
    pub size: f64,
    pub status: String,
}

pub struct OrderExecutor {
    pm_client: std::sync::Arc<PolymarketClient>,
    active_orders: HashMap<String, Order>,
}

impl OrderExecutor {
    pub fn new(polymarket_client: std::sync::Arc<PolymarketClient>) -> Self {
        Self {
            pm_client: polymarket_client,
            active_orders: HashMap::new(),
        }
    }

    pub async fn place_order(
        &mut self,
        market_id: &str,
        outcome: &str,
        side: &str,
        price: f64,
        size: f64,
    ) -> Option<Order> {
        log::info!(
            "Placing order: {} {:.4} {} @ {:.4} in market {}",
            side,
            size,
            outcome,
            price,
            market_id
        );

        let order_result = self
            .pm_client
            .place_order(market_id, outcome, side, price, size)
            .await;

        if let Some(result) = order_result {
            let order_id = result
                .get("id")
                .or_else(|| result.get("orderId"))
                .and_then(|v| v.as_str())
                .map(|s| s.to_string())
                .unwrap_or_else(|| uuid::Uuid::new_v4().to_string());

            let order = Order {
                order_id: order_id.clone(),
                market_id: market_id.to_string(),
                outcome: outcome.to_string(),
                side: side.to_string(),
                price,
                size,
                status: "pending".to_string(),
            };

            self.active_orders.insert(order_id.clone(), order.clone());
            log::info!("Order placed successfully: {}", order_id);
            Some(order)
        } else {
            log::error!("Failed to place order - no result from API");
            None
        }
    }

    pub async fn cancel_order(&mut self, order_id: &str) -> bool {
        if !self.active_orders.contains_key(order_id) {
            log::warn!("Order {} not found in active orders", order_id);
            return false;
        }

        let success = self.pm_client.cancel_order(order_id).await;

        if success {
            if let Some(order) = self.active_orders.get_mut(order_id) {
                order.status = "cancelled".to_string();
            }
            log::info!("Order cancelled: {}", order_id);
            true
        } else {
            log::error!("Failed to cancel order: {}", order_id);
            false
        }
    }

    pub fn get_active_orders(&self) -> HashMap<String, Order> {
        self.active_orders.clone()
    }

    pub fn get_market_orders(&self, market_id: &str) -> Vec<Order> {
        self.active_orders
            .values()
            .filter(|order| order.market_id == market_id)
            .cloned()
            .collect()
    }
}
