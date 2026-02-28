use crate::clob::ApiCreds;
use anyhow::{Context, Result};
use base64::{engine::general_purpose::STANDARD as BASE64, Engine};
use ethers::signers::Signer;
use hmac::{Hmac, Mac};
use sha2::Sha256;
use std::time::{SystemTime, UNIX_EPOCH};
use tracing::info;

type HmacSha256 = Hmac<Sha256>;

pub fn wallet_address(private_key: &str) -> Result<String> {
    let key = private_key.trim_start_matches("0x");
    let bytes = hex::decode(key).context("invalid private key hex")?;
    let wallet = ethers::signers::LocalWallet::from_bytes(&bytes).context("wallet from bytes")?;
    Ok(format!("{:?}", wallet.address()))
}

pub fn sign_clob_auth(private_key: &str, chain_id: u64, timestamp: u64, nonce: u64) -> Result<String> {
    let key = private_key.trim_start_matches("0x");
    let bytes = hex::decode(key).context("invalid private key hex")?;
    let wallet = ethers::signers::LocalWallet::from_bytes(&bytes).context("wallet from bytes")?;
    let msg = "This message attests that I control the given wallet";
    let domain_separator = eip712_domain_hash(chain_id);
    let struct_hash = clob_auth_struct_hash(wallet.address(), timestamp, nonce, msg);
    let mut prefixed: Vec<u8> = vec![0x19, 0x01];
    prefixed.extend_from_slice(&domain_separator);
    prefixed.extend_from_slice(&struct_hash);
    let digest = ethers::utils::keccak256(prefixed);
    let sig = wallet.sign_hash(ethers::types::H256::from_slice(&digest))?;
    let sig_hex = format!("0x{}", hex::encode(sig.to_vec()));
    Ok(sig_hex)
}

fn eip712_domain_hash(chain_id: u64) -> Vec<u8> {
    let type_hash = ethers::utils::keccak256("EIP712Domain(string name,string version,uint256 chainId)");
    let name_hash = ethers::utils::keccak256("ClobAuthDomain");
    let version_hash = ethers::utils::keccak256("1");
    let chain_id_bytes = chain_id.to_be_bytes();
    let mut chain_id_32 = [0u8; 32];
    chain_id_32[24..].copy_from_slice(&chain_id_bytes);
    let encoded = [type_hash.as_ref(), name_hash.as_ref(), version_hash.as_ref(), &chain_id_32].concat();
    ethers::utils::keccak256(encoded).to_vec()
}

fn clob_auth_struct_hash(addr: ethers::types::Address, timestamp: u64, nonce: u64, message: &str) -> Vec<u8> {
    let type_hash = ethers::utils::keccak256("ClobAuth(address address,string timestamp,uint256 nonce,string message)");
    let addr_padded = {
        let mut b = [0u8; 32];
        b[12..32].copy_from_slice(addr.as_bytes());
        b
    };
    let ts_str = timestamp.to_string();
    let ts_hash = ethers::utils::keccak256(ts_str.as_bytes());
    let nonce_bytes = {
        let mut b = [0u8; 32];
        let n = nonce.to_be_bytes();
        b[24..32].copy_from_slice(&n);
        b
    };
    let msg_hash = ethers::utils::keccak256(message.as_bytes());
    let encoded = [type_hash.as_ref(), addr_padded.as_slice(), ts_hash.as_ref(), nonce_bytes.as_slice(), msg_hash.as_ref()].concat();
    ethers::utils::keccak256(encoded).to_vec()
}

pub fn build_l2_signature(secret_b64: &str, timestamp: u64, method: &str, path: &str, body: Option<&str>) -> Result<String> {
    let secret = secret_b64.replace('-', "+").replace('_', "/");
    let decoded = BASE64.decode(secret.as_bytes()).context("base64 decode secret")?;
    let mut msg = format!("{}{}{}", timestamp, method, path);
    if let Some(b) = body {
        msg.push_str(b);
    }
    let mut mac = HmacSha256::new_from_slice(&decoded).context("hmac key")?;
    mac.update(msg.as_bytes());
    let result = mac.finalize();
    let sig = BASE64.encode(result.into_bytes());
    let url_safe = sig.replace('+', "-").replace('/', "_");
    Ok(url_safe)
}

#[derive(Clone)]
pub struct ClobClient {
    pub base_url: String,
    pub creds: ApiCreds,
    pub wallet_address: String,
    pub signature_type: u8,
}

impl ClobClient {
    pub fn new(base_url: String, creds: ApiCreds, wallet_address: String, signature_type: u8) -> Self {
        Self { base_url, creds, wallet_address, signature_type }
    }

    pub async fn get_balance_allowance(&self, asset_type: &str) -> Result<BalanceAllowanceResponse> {
        let ts = SystemTime::now().duration_since(UNIX_EPOCH)?.as_secs();
        let path = format!("/balance-allowance?asset_type={}&signature_type={}", asset_type, self.signature_type);
        let sig = build_l2_signature(&self.creds.secret, ts, "GET", &path, None)?;
        let url = format!("{}{}", self.base_url.trim_end_matches('/'), path);
        let client = reqwest::Client::new();
        let res = client
            .get(&url)
            .header("POLY_ADDRESS", &self.wallet_address)
            .header("POLY_SIGNATURE", sig)
            .header("POLY_TIMESTAMP", ts.to_string())
            .header("POLY_API_KEY", &self.creds.api_key)
            .header("POLY_PASSPHRASE", &self.creds.passphrase)
            .send()
            .await?;
        let out: BalanceAllowanceResponse = res.json().await?;
        Ok(out)
    }

    pub async fn update_balance_allowance(&self, asset_type: &str) -> Result<()> {
        let ts = SystemTime::now().duration_since(UNIX_EPOCH)?.as_secs();
        let path = "/balance-allowance/update";
        let body = format!(r#"{{"asset_type":"{}"}}"#, asset_type);
        let sig = build_l2_signature(&self.creds.secret, ts, "POST", path, Some(&body))?;
        let url = format!("{}{}", self.base_url.trim_end_matches('/'), path);
        let client = reqwest::Client::new();
        let res = client
            .post(&url)
            .header("POLY_ADDRESS", &self.wallet_address)
            .header("POLY_SIGNATURE", sig)
            .header("POLY_TIMESTAMP", ts.to_string())
            .header("POLY_API_KEY", &self.creds.api_key)
            .header("POLY_PASSPHRASE", &self.creds.passphrase)
            .body(body)
            .send()
            .await?;
        if !res.status().is_success() {
            let t = res.text().await.unwrap_or_default();
            anyhow::bail!("update balance allowance failed: {}", t);
        }
        info!("CLOB balance allowance updated");
        Ok(())
    }

    pub async fn get_open_orders(&self, asset_id: Option<&str>) -> Result<Vec<OpenOrder>> {
        let ts = SystemTime::now().duration_since(UNIX_EPOCH)?.as_secs();
        let path = if let Some(id) = asset_id {
            format!("/data/orders?asset_id={}", id)
        } else {
            "/data/orders".to_string()
        };
        let sig = build_l2_signature(&self.creds.secret, ts, "GET", &path, None)?;
        let url = format!("{}{}", self.base_url.trim_end_matches('/'), path);
        let client = reqwest::Client::new();
        let res = client
            .get(&url)
            .header("POLY_ADDRESS", &self.wallet_address)
            .header("POLY_SIGNATURE", sig)
            .header("POLY_TIMESTAMP", ts.to_string())
            .header("POLY_API_KEY", &self.creds.api_key)
            .header("POLY_PASSPHRASE", &self.creds.passphrase)
            .send()
            .await?;
        let out: Vec<OpenOrder> = res.json().await.unwrap_or_default();
        Ok(out)
    }
}

#[derive(serde::Deserialize)]
pub struct BalanceAllowanceResponse {
    pub balance: Option<String>,
    pub allowance: Option<String>,
}

#[derive(serde::Deserialize)]
pub struct OpenOrder {
    pub side: Option<String>,
    pub original_size: Option<String>,
    pub size_matched: Option<String>,
}
