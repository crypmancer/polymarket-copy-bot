use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use std::path::Path;
use std::time::{SystemTime, UNIX_EPOCH};
use tracing::info;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiCreds {
    pub api_key: String,
    pub secret: String,
    pub passphrase: String,
}

pub async fn create_or_load_credential(
    clob_base_url: &str,
    chain_id: u64,
    private_key: &str,
    credential_path: &Path,
) -> Result<Option<ApiCreds>> {
    if credential_path.exists() {
        let s = std::fs::read_to_string(credential_path).context("read credential file")?;
        let creds: ApiCreds = serde_json::from_str(&s).context("parse credential")?;
        info!("Loaded existing credentials");
        return Ok(Some(creds));
    }

    let ts = SystemTime::now().duration_since(UNIX_EPOCH)?.as_secs();
    let sig = crate::clob::client::sign_clob_auth(private_key, chain_id, ts, 0)?;
    let wallet_addr = crate::clob::client::wallet_address(private_key)?;

    let url = format!("{}/auth/derive-api-key?timestamp={}&nonce=0", clob_base_url.trim_end_matches('/'), ts);
    let client = reqwest::Client::new();
    let res = client
        .get(&url)
        .header("POLY_ADDRESS", format!("{:?}", wallet_addr))
        .header("POLY_SIGNATURE", sig)
        .header("POLY_TIMESTAMP", ts.to_string())
        .header("POLY_NONCE", "0")
        .send()
        .await
        .context("derive API key request")?;

    let status = res.status();
    if !status.is_success() {
        let body = res.text().await.unwrap_or_default();
        anyhow::bail!("Failed to derive API key: {} {}", status, body);
    }

    let creds: ApiCreds = res.json().await.context("parse API key response")?;
    if let Some(parent) = credential_path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    std::fs::write(credential_path, serde_json::to_string_pretty(&creds)?)?;
    info!("Credentials created and saved");
    Ok(Some(creds))
}
