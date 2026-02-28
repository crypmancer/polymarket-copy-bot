use anyhow::Result;
use futures_util::{SinkExt, StreamExt};
use serde::Deserialize;
use std::sync::atomic::{AtomicBool, Ordering};
use tokio_tungstenite::{connect_async, tungstenite::Message};
use tracing::{info, warn};
use url::Url;

#[derive(Debug, Clone, Deserialize)]
pub struct TradePayload {
    pub asset: String,
    pub condition_id: Option<String>,
    #[serde(rename = "conditionId")]
    pub condition_id_alt: Option<String>,
    pub outcome: Option<String>,
    pub price: f64,
    #[serde(rename = "proxyWallet")]
    pub proxy_wallet: Option<String>,
    pub side: String,
    pub size: f64,
    pub slug: Option<String>,
    pub timestamp: Option<u64>,
    pub title: Option<String>,
    #[serde(rename = "transactionHash")]
    pub transaction_hash: Option<String>,
}

impl TradePayload {
    pub fn condition_id(&self) -> Option<&str> {
        self.condition_id.as_deref().or(self.condition_id_alt.as_deref())
    }
}

#[derive(Debug, Deserialize)]
pub struct WsMessage {
    pub topic: Option<String>,
    #[serde(rename = "type")]
    pub msg_type: Option<String>,
    pub payload: Option<serde_json::Value>,
}

pub async fn run_feed<F, Fut>(
    ws_url: &str,
    target_wallet: &str,
    copy_trading_paused: &AtomicBool,
    enable_copy_trading: bool,
    mut on_trade: F,
) -> Result<()>
where
    F: FnMut(TradePayload) -> Fut + Send,
    Fut: std::future::Future<Output = Result<()>> + Send,
{
    let url = Url::parse(ws_url)?;
    let (ws, _) = connect_async(url).await?;
    let (mut write, mut read) = ws.split();
    info!("Connected to real-time feed");

    let sub = serde_json::json!({
        "auth": {},
        "type": "subscribe",
        "subscriptions": [{ "topic": "activity", "type": "trades" }]
    });
    write.send(Message::Text(sub.to_string())).await?;
    info!("Subscribed to activity:trades");

    while let Some(msg) = read.next().await {
        let msg = match msg {
            Ok(Message::Text(t)) => t,
            Ok(Message::Ping(d)) => {
                let _ = write.send(Message::Pong(d)).await;
                continue;
            }
            Ok(Message::Close(_)) => break,
            Err(e) => {
                warn!("WS error: {}", e);
                break;
            }
            _ => continue,
        };

        let parsed: WsMessage = match serde_json::from_str(&msg) {
            Ok(p) => p,
            _ => continue,
        };
        if parsed.topic.as_deref() != Some("activity") || parsed.msg_type.as_deref() != Some("trades") {
            continue;
        }
        let payload: TradePayload = match parsed.payload {
            Some(p) => match serde_json::from_value(p) {
                Ok(pl) => pl,
                _ => continue,
            },
            None => continue,
        };
        let proxy: String = match &payload.proxy_wallet {
            Some(w) => w.to_lowercase(),
            None => continue,
        };
        if proxy != target_wallet.to_lowercase() {
            continue;
        }

        info!(
            "Trade detected: side={} price={} size={} market={}",
            payload.side,
            payload.price,
            payload.size,
            payload.title.as_deref().unwrap_or("")
        );

        if enable_copy_trading && !copy_trading_paused.load(Ordering::SeqCst) {
            if let Err(e) = on_trade(payload).await {
                warn!("Copy trade error: {}", e);
            }
        }
    }
    Ok(())
}
