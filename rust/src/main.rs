use anyhow::Result;
use clap::{Parser, Subcommand};
use polymarket_copy_bot::{
    auto_redeem_resolved_markets, create_or_load_credential, run_feed, ClobClient, Config,
    TradeOrderBuilder,
};
use polymarket_copy_bot::{approve_usdc_allowance, display_wallet_balance};
use std::sync::atomic::AtomicBool;
use std::sync::Arc;
use std::time::Duration;
use tracing::{error, info};
use tracing_subscriber::EnvFilter;

#[derive(Parser)]
#[command(name = "polymarket-copy-bot")]
#[command(about = "Polymarket copy trading bot")]
struct Cli {
    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    /// Run the copy-trading bot
    Bot,
    /// Redeem positions for a condition ID
    Redeem {
        #[arg(required = true)]
        condition_id: String,
        #[arg(last = true)]
        index_sets: Vec<u64>,
    },
    /// Auto-redeem all resolved markets from holdings
    AutoRedeem {
        #[arg(long)]
        dry_run: bool,
        #[arg(long)]
        api: bool,
    },
}

#[tokio::main]
async fn main() -> Result<()> {
    dotenvy::dotenv().ok();
    let filter = EnvFilter::from_default_env().add_directive("polymarket_copy_bot=info".parse()?);
    tracing_subscriber::fmt().with_env_filter(filter).init();

    let cli = Cli::parse();
    match cli.command {
        Commands::Bot => run_bot().await,
        Commands::Redeem { condition_id, index_sets } => run_redeem(condition_id, index_sets).await,
        Commands::AutoRedeem { dry_run, api } => run_auto_redeem(dry_run, api).await,
    }
}

async fn run_bot() -> Result<()> {
    let config = Config::from_env()?;
    info!("Starting the bot...");
    info!("Target Wallet: {}", config.target_wallet);
    info!("Size Multiplier: {}x", config.size_multiplier);
    info!("Copy Trading: {}", if config.enable_copy_trading { "enabled" } else { "disabled" });

    let creds = create_or_load_credential(
        &config.clob_api_url,
        config.chain_id,
        &config.private_key,
        &config.credential_path,
    )
    .await?;
    let creds = match creds {
        Some(c) => c,
        None => {
            error!("No credentials - run once with TS bot to create credential.json or implement L1 create");
            return Ok(());
        }
    };

    let wallet_addr = polymarket_copy_bot::wallet_address(&config.private_key)?;
    let clob = ClobClient::new(
        config.clob_api_url.clone(),
        creds.clone(),
        wallet_addr,
        2, // GNOSIS_SAFE
    );

    if config.enable_copy_trading {
        let provider = ethers::prelude::Provider::<ethers::prelude::Http>::try_from(&config.rpc_url)?;
        let wallet = ethers::signers::LocalWallet::from_bytes(
            &hex::decode(config.private_key.trim_start_matches("0x"))?,
        )?;
        approve_usdc_allowance(&provider, &wallet, config.chain_id, config.neg_risk).await?;
        clob.update_balance_allowance("COLLATERAL").await?;
        display_wallet_balance(&clob).await?;

        let order_builder = Arc::new(TradeOrderBuilder::new(
            clob.clone(),
            provider,
            wallet,
            config.chain_id,
            config.holdings_path.clone(),
            config.tick_size.as_str().to_string(),
            config.neg_risk,
            if config.order_type == polymarket_copy_bot::config::OrderType::FOK {
                "FOK".to_string()
            } else {
                "FAK".to_string()
            },
        ));

        let copy_paused = Arc::new(AtomicBool::new(false));
        let redeem_duration = config.redeem_duration_minutes;
        let holdings_path = config.holdings_path.clone();
        let chain_id = config.chain_id;
        let private_key = config.private_key.clone();
        let rpc_url = config.rpc_url.clone();

        if let Some(mins) = redeem_duration {
            let copy_paused_clone = copy_paused.clone();
            let interval = Duration::from_secs(mins * 60);
            tokio::spawn(async move {
                let mut interval = tokio::time::interval(interval);
                loop {
                    interval.tick().await;
                    copy_paused_clone.store(true, std::sync::atomic::Ordering::SeqCst);
                    info!("Copy trading PAUSED for redemption");
                    let summary = auto_redeem_resolved_markets(
                        &holdings_path,
                        chain_id,
                        &private_key,
                        &rpc_url,
                        3,
                    )
                    .await;
                    if let Ok(s) = summary {
                        info!("Redemption: total={} resolved={} redeemed={} failed={}", s.total, s.resolved, s.redeemed, s.failed);
                    }
                    copy_paused_clone.store(false, std::sync::atomic::Ordering::SeqCst);
                    info!("Copy trading RESUMED");
                }
            });
        }

        let target = config.target_wallet.clone();
        let size_mult = config.size_multiplier;
        let max_amt = config.max_order_amount;
        let order_builder = order_builder.clone();
        run_feed(
            &config.ws_url,
            &target,
            copy_paused.as_ref(),
            config.enable_copy_trading,
            move |trade| {
                let ob = order_builder.clone();
                async move {
                    ob.copy_trade(&trade, size_mult, max_amt).await?;
                    Ok(())
                }
            },
        )
        .await?;
    } else {
        run_feed(
            &config.ws_url,
            &config.target_wallet,
            &AtomicBool::new(false),
            false,
            |_| async { Ok(()) },
        )
        .await?;
    }
    Ok(())
}

async fn run_redeem(condition_id: String, index_sets: Vec<u64>) -> Result<()> {
    let config = Config::from_env()?;
    let sets = if index_sets.is_empty() { vec![1, 2] } else { index_sets };
    polymarket_copy_bot::redeem_positions(
        &condition_id,
        Some(sets),
        config.chain_id,
        &config.private_key,
        &config.rpc_url,
    )
    .await
}

async fn run_auto_redeem(_dry_run: bool, _api: bool) -> Result<()> {
    let config = Config::from_env()?;
    let summary = auto_redeem_resolved_markets(
        &config.holdings_path,
        config.chain_id,
        &config.private_key,
        &config.rpc_url,
        3,
    )
    .await?;
    info!("Total: {} Resolved: {} Redeemed: {} Failed: {}", summary.total, summary.resolved, summary.redeemed, summary.failed);
    Ok(())
}
