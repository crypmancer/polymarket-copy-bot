mod arbitrage_detector;
mod bot;
mod config;
mod copy_trader;
mod on_chain_monitor;
mod order_executor;
mod polymarket_client;
mod risk_manager;
mod wallet_monitor;

use std::sync::Arc;
use bot::PolymarketArbCopyBot;
use config::load_config;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    env_logger::init();

    // Load configuration
    let config = load_config();

    // Validate configuration
    if config.wallets.is_empty() {
        eprintln!("No wallets configured! Please set TARGET_WALLET_1 in .env file");
        std::process::exit(1);
    }

    // Create and start bot
    let mut bot = PolymarketArbCopyBot::new(config);
    bot.start().await?;

    // Keep the main thread alive
    tokio::signal::ctrl_c().await?;
    log::info!("\nReceived shutdown signal");
    bot.stop().await;

    Ok(())
}
