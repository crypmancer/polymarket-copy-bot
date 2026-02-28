use crate::chain::get_contract_config;
use anyhow::{Context, Result};
use ethers::prelude::*;
use ethers::types::{Address, Bytes, U256};
use std::sync::Arc;
use tracing::info;

const USDC_APPROVE_SELECTOR: [u8; 4] = [0x09, 0x5e, 0xa7, 0xb3]; // approve(address,uint256)
const CTF_SET_APPROVAL_SELECTOR: [u8; 4] = [0xa2, 0x2c, 0x46, 0x0d]; // setApprovalForAll(address,bool)

fn max_uint256() -> U256 {
    U256::max_value()
}

pub async fn approve_usdc_allowance(
    provider: &Provider<Http>,
    wallet: &LocalWallet,
    chain_id: u64,
    neg_risk: bool,
) -> Result<()> {
    let client = SignerMiddleware::new(provider.clone(), wallet.clone());
    let client = Arc::new(client);
    let cfg = get_contract_config(chain_id);
    let address = wallet.address();

    let usdc = address_from_hex(&cfg.collateral)?;
    let ctf = address_from_hex(&cfg.conditional_tokens)?;
    let exchange = address_from_hex(&cfg.exchange)?;

    info!("Approving USDC for address: {:?}, chain_id: {}", address, chain_id);

    let gas_price = provider.get_gas_price().await.unwrap_or(U256::from(100_000_000_000u64));
    let gas_options = GasOpts::default()
        .with_gas_price(gas_price * 120 / 100)
        .with_gas(200_000u64);

    // USDC approve ConditionalTokens
    let allowance_ctf = call_allowance(&client, usdc, address, ctf).await?;
    if allowance_ctf != max_uint256() {
        call_approve(&client, usdc, ctf, max_uint256(), &gas_options).await?;
        info!("USDC approved for ConditionalTokens");
    } else {
        info!("USDC already approved for ConditionalTokens");
    }

    // USDC approve Exchange
    let allowance_ex = call_allowance(&client, usdc, address, exchange).await?;
    if allowance_ex != max_uint256() {
        call_approve(&client, usdc, exchange, max_uint256(), &gas_options).await?;
        info!("USDC approved for Exchange");
    } else {
        info!("USDC already approved for Exchange");
    }

    // CTF setApprovalForAll Exchange
    if !call_is_approved_for_all(&client, ctf, address, exchange).await? {
        call_set_approval_for_all(&client, ctf, exchange, true, &gas_options).await?;
        info!("ConditionalTokens approved for Exchange");
    } else {
        info!("ConditionalTokens already approved for Exchange");
    }

    if neg_risk {
        let neg_adapter = address_from_hex(&cfg.neg_risk_adapter)?;
        let neg_exchange = address_from_hex(&cfg.neg_risk_exchange)?;

        let a1 = call_allowance(&client, usdc, address, neg_adapter).await?;
        if a1 != max_uint256() {
            call_approve(&client, usdc, neg_adapter, max_uint256(), &gas_options).await?;
            info!("USDC approved for NegRiskAdapter");
        }
        let a2 = call_allowance(&client, usdc, address, neg_exchange).await?;
        if a2 != max_uint256() {
            call_approve(&client, usdc, neg_exchange, max_uint256(), &gas_options).await?;
            info!("USDC approved for NegRiskExchange");
        }
        if !call_is_approved_for_all(&client, ctf, address, neg_exchange).await? {
            call_set_approval_for_all(&client, ctf, neg_exchange, true, &gas_options).await?;
            info!("ConditionalTokens approved for NegRiskExchange");
        }
        if !call_is_approved_for_all(&client, ctf, address, neg_adapter).await? {
            call_set_approval_for_all(&client, ctf, neg_adapter, true, &gas_options).await?;
            info!("ConditionalTokens approved for NegRiskAdapter");
        }
    }

    Ok(())
}

pub async fn approve_tokens_after_buy(
    provider: &Provider<Http>,
    wallet: &LocalWallet,
    chain_id: u64,
    neg_risk: bool,
) -> Result<()> {
    let client = SignerMiddleware::new(provider.clone(), wallet.clone());
    let client = Arc::new(client);
    let cfg = get_contract_config(chain_id);
    let address = wallet.address();
    let ctf = address_from_hex(&cfg.conditional_tokens)?;
    let exchange = address_from_hex(&cfg.exchange)?;

    if !call_is_approved_for_all(&client, ctf, address, exchange).await? {
        let gas_price = provider.get_gas_price().await.unwrap_or(U256::from(100_000_000_000u64));
        let gas_options = GasOpts::default()
            .with_gas_price(gas_price * 120 / 100)
            .with_gas(200_000u64);
        call_set_approval_for_all(&client, ctf, exchange, true, &gas_options).await?;
        info!("ConditionalTokens approved for Exchange (after buy)");
    }

    if neg_risk {
        let neg_exchange = address_from_hex(&cfg.neg_risk_exchange)?;
        if !call_is_approved_for_all(&client, ctf, address, neg_exchange).await? {
            let gas_price = provider.get_gas_price().await.unwrap_or(U256::from(100_000_000_000u64));
            let gas_options = GasOpts::default()
                .with_gas_price(gas_price * 120 / 100)
                .with_gas(200_000u64);
            call_set_approval_for_all(&client, ctf, neg_exchange, true, &gas_options).await?;
            info!("ConditionalTokens approved for NegRiskExchange (after buy)");
        }
    }

    Ok(())
}

fn address_from_hex(s: &str) -> Result<Address> {
    let s = s.trim_start_matches("0x");
    let bytes = hex::decode(s).context("Invalid address hex")?;
    if bytes.len() != 20 {
        anyhow::bail!("Address must be 20 bytes");
    }
    let mut arr = [0u8; 20];
    arr.copy_from_slice(&bytes);
    Ok(Address::from(arr))
}

async fn call_allowance(
    client: &Arc<SignerMiddleware<Provider<Http>, LocalWallet>>,
    token: Address,
    owner: Address,
    spender: Address,
) -> Result<U256> {
    let allowance_selector = [0xdd, 0x62, 0xed, 0x3e]; // allowance(address,address)
    let mut data = Vec::from(allowance_selector);
    data.extend_from_slice(&ethers::abi::encode(&[ethers::abi::Token::Address(owner), ethers::abi::Token::Address(spender)]));
    let tx = TransactionRequest::default()
        .to(token)
        .data(Bytes::from(data));
    let res = client.call(&tx.into(), None).await.context("allowance call")?;
    let out: [u8; 32] = res.as_ref().try_into().context("allowance result length")?;
    Ok(U256::from_big_endian(&out))
}

async fn call_approve(
    client: &Arc<SignerMiddleware<Provider<Http>, LocalWallet>>,
    token: Address,
    spender: Address,
    amount: U256,
    gas_opts: &GasOpts,
) -> Result<()> {
    let mut data = Vec::from(USDC_APPROVE_SELECTOR);
    data.extend_from_slice(&ethers::abi::encode(&[
        ethers::abi::Token::Address(spender),
        ethers::abi::Token::Uint(amount),
    ]));
    let tx = TransactionRequest::default()
        .to(token)
        .data(Bytes::from(data))
        .gas(gas_opts.gas.unwrap_or(200_000))
        .gas_price(gas_opts.gas_price.unwrap_or(U256::from(100_000_000_000u64)));
    let pending = client.send_transaction(tx, None).await.context("approve send")?;
    let receipt = pending.await.context("approve receipt")?;
    info!("Approve tx: {:?}", receipt.map(|r| r.transaction_hash));
    Ok(())
}

async fn call_is_approved_for_all(
    client: &Arc<SignerMiddleware<Provider<Http>, LocalWallet>>,
    ctf: Address,
    account: Address,
    operator: Address,
) -> Result<bool> {
    let selector = [0xe9, 0x85, 0xe9, 0xc5]; // isApprovedForAll(address,address)
    let mut data = Vec::from(selector);
    data.extend_from_slice(&ethers::abi::encode(&[
        ethers::abi::Token::Address(account),
        ethers::abi::Token::Address(operator),
    ]));
    let tx = TransactionRequest::default().to(ctf).data(Bytes::from(data));
    let res = client.call(&tx.into(), None).await.context("isApprovedForAll call")?;
    if res.len() >= 32 {
        Ok(res[31] != 0)
    } else {
        Ok(false)
    }
}

async fn call_set_approval_for_all(
    client: &Arc<SignerMiddleware<Provider<Http>, LocalWallet>>,
    ctf: Address,
    operator: Address,
    approved: bool,
    gas_opts: &GasOpts,
) -> Result<()> {
    let mut data = Vec::from(CTF_SET_APPROVAL_SELECTOR);
    data.extend_from_slice(&ethers::abi::encode(&[
        ethers::abi::Token::Address(operator),
        ethers::abi::Token::Bool(approved),
    ]));
    let tx = TransactionRequest::default()
        .to(ctf)
        .data(Bytes::from(data))
        .gas(gas_opts.gas.unwrap_or(200_000))
        .gas_price(gas_opts.gas_price.unwrap_or(U256::from(100_000_000_000u64)));
    let pending = client.send_transaction(tx, None).await.context("setApprovalForAll send")?;
    let _ = pending.await;
    info!("setApprovalForAll tx sent");
    Ok(())
}

struct GasOpts {
    gas: Option<u64>,
    gas_price: Option<U256>,
}

impl Default for GasOpts {
    fn default() -> Self {
        Self { gas: None, gas_price: None }
    }
}

impl GasOpts {
    fn with_gas(mut self, g: u64) -> Self {
        self.gas = Some(g);
        self
    }
    fn with_gas_price(mut self, p: U256) -> Self {
        self.gas_price = Some(p);
        self
    }
}
