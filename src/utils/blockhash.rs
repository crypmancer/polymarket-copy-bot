use solana_client::nonblocking::rpc_client::RpcClient;
use solana_program::pubkey;
use solana_sdk::{commitment_config::CommitmentConfig, hash::Hash};
use std::sync::Arc;
use tokio::time::{Duration, sleep};

use once_cell::sync::Lazy;
use std::sync::Mutex;

static GLOBAL_CURRENT_HASH: Lazy<Mutex<Hash>> = Lazy::new(|| Mutex::new(Hash::default()));

fn set_slot(value: Hash) {
    let mut slot = GLOBAL_CURRENT_HASH.lock().unwrap();
    *slot = value;
}

pub fn get_slot() -> Hash {
    let slot = GLOBAL_CURRENT_HASH.lock().unwrap();
    *slot
}

/// Continuously retries fetching the latest blockhash until successful.
pub async fn recent_blockhash_handler(rpc_client: Arc<RpcClient>) {
    loop {
        match rpc_client
            .get_latest_blockhash_with_commitment(CommitmentConfig::processed())
            .await
        {
            Ok((latest_blockhash, _)) => {
                set_slot(latest_blockhash);
                break; // Exit the loop once we get a valid blockhash
            }
            Err(e) => {
                sleep(Duration::from_millis(200)).await;
            }
        }
    }

    sleep(Duration::from_millis(500)).await;
}

pub const WSOL: solana_program::pubkey::Pubkey =
    pubkey!("So11111111111111111111111111111111111111112");
