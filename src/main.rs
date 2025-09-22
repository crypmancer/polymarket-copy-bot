use {
    async_trait::async_trait, borsh::BorshDeserialize, carbon_core::{
        deserialize::{ArrangeAccounts, CarbonDeserialize},
        error::CarbonResult,
        instruction::{
            DecodedInstruction, InstructionMetadata, InstructionProcessorInputType,
            NestedInstructions,
        },
        metrics::MetricsCollection,
        processor::Processor,
    }, carbon_log_metrics::LogMetrics, carbon_pumpfun_decoder::{
        instructions::{
            buy::Buy, create::Create, create_event::CreateEvent, sell::Sell, trade_event::TradeEvent, PumpfunInstruction
        }, PumpfunDecoder, PROGRAM_ID as PUMPFUN_PROGRAM_ID
    }, carbon_raydium_launchpad_decoder::{
        instructions::{
            buy_exact_in::BuyExactIn, sell_exact_in::SellExactIn, trade_event::TradeEvent as BonkTradeEvent, RaydiumLaunchpadInstruction
        }, RaydiumLaunchpadDecoder, PROGRAM_ID as RAY_LAUNCHPAD_PROGRAM_ID
    }, carbon_yellowstone_grpc_datasource::YellowstoneGrpcGeyserClient, chrono::Utc, core::panic, once_cell::sync::Lazy, pumpfun_monitor::{
        config::{
            init_jito, init_nozomi, init_zslot, targetlist, BUY_SOL_AMOUNT, CONFIRM_SERVICE, JITO_CLIENT, NOZOMI_CLIENT, PRIORITY_FEE, PUBKEY, RPC_CLIENT, SLIPPAGE, TARGET_DEX, ZSLOT_CLIENT
        },
        instructions::{
            buy_ix::BuyExactInInstructionAccountsExt,
            ray_buy_tx::BuyExactInInstructionAccountsExt as RayBuyExt,
            ray_sell_tx::SellExactInInstructionAccountsExt as RaySellExt,
            sell_ix::SellExactInInstructionAccountsExt, types::TradeEventTemp,
        },
        service::Tips,
        utils::{
            blockhash::{get_slot, recent_blockhash_handler}, build_and_sign, get_swap_quote, sol_token_quote, token_sol_quote, TRADE_EVENT_DISC
        },
    }, serde_json::json, solana_client::nonblocking::rpc_client, solana_sdk::{commitment_config::CommitmentConfig, transaction}, solana_transaction_status_client_types::InnerInstruction, spl_associated_token_account::{
        get_associated_token_address, instruction::create_associated_token_account_idempotent,
    }, std::{
        collections::{HashMap, HashSet},
        env,
        ops::{Add, Sub},
        sync::Arc,
        time::Duration,
        vec,
    }, tokio::{sync::RwLock, time::sleep}, yellowstone_grpc_proto::geyser::{
        CommitmentLevel, SubscribeRequestFilterAccounts, SubscribeRequestFilterTransactions,
    }
};

#[tokio::main]
pub async fn main() -> CarbonResult<()> {
    env_logger::init();
    dotenv::dotenv().ok();

    init_nozomi().await;
    init_zslot().await;
    init_jito().await;

    tokio::spawn({
        async move {
            loop {
                recent_blockhash_handler(RPC_CLIENT.clone()).await;
            }
        }
    });

    println!("TARGET_DEX : {}", TARGET_DEX.to_string());

    // NOTE: Workaround, that solving issue https://github.com/rustls/rustls/issues/1877
    rustls::crypto::aws_lc_rs::default_provider()
        .install_default()
        .expect("Can't set crypto provider to aws_lc_rs");

    let targetlist = targetlist::Targetlist::new("targetlist.txt")
        .unwrap_or_else(|_| targetlist::Targetlist::empty());

    let mut account_include = targetlist.addresses;
    account_include.push("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s".to_string());

    let transaction_filter = SubscribeRequestFilterTransactions {
        vote: Some(false),
        failed: Some(false),
        account_include: account_include,
        account_exclude: vec![],
        account_required: vec!["FfYek5vEz23cMkWsdJwG2oa6EphsvXSHrGpdALN4g6W1".to_string()],
        signature: None,
    };

    println!("Using payer: {}", *PUBKEY);

    let mut transaction_filters: HashMap<String, SubscribeRequestFilterTransactions> =
        HashMap::new();

    transaction_filters.insert(
        "jupiter_swap_transaction_filter".to_string(),
        transaction_filter,
    );

    let yellowstone_grpc = YellowstoneGrpcGeyserClient::new(
        env::var("GEYSER_URL").unwrap_or_default(),
        env::var("X_TOKEN").ok(),
        Some(CommitmentLevel::Processed),
        HashMap::new(),
        transaction_filters.clone(),
        Default::default(),
        Arc::new(RwLock::new(HashSet::new())),
    );

    println!("Starting Pump-Bonk Monitor...");

    carbon_core::pipeline::Pipeline::builder()
        .datasource(yellowstone_grpc)
        // .datasource(helius_laserstream)
        .metrics(Arc::new(LogMetrics::new()))
        .metrics_flush_interval(3)
        .instruction(RaydiumLaunchpadDecoder, RayLaunchPadProcess)
        .shutdown_strategy(carbon_core::pipeline::ShutdownStrategy::Immediate)
        .build()?
        .run()
        .await?;

    println!("Pump-Bonk Monitor has stopped.");

    Ok(())
}

pub struct PumpfunProcess;

pub static SIGNATURES: Lazy<RwLock<HashSet<String>>> = Lazy::new(|| RwLock::new(HashSet::new()));

pub struct RayLaunchPadProcess;

#[async_trait]
impl Processor for RayLaunchPadProcess {
    type InputType = InstructionProcessorInputType<RaydiumLaunchpadInstruction>;

    async fn process(
        &mut self,
        (metadata, instruction, nested_instructions, instructions): Self::InputType,
        _metrics: Arc<MetricsCollection>,
    ) -> CarbonResult<()> {
        let signature = metadata.transaction_metadata.signature;

        let static_account_keys = metadata.transaction_metadata.message.static_account_keys();
        let writable_account_keys = &metadata.transaction_metadata.meta.loaded_addresses.writable;
        let readonly_account_keys = &metadata.transaction_metadata.meta.loaded_addresses.readonly;

        let mut account_keys: Vec<solana_sdk::pubkey::Pubkey> = vec![];

        account_keys.extend(static_account_keys);
        account_keys.extend(writable_account_keys);
        account_keys.extend(readonly_account_keys);

        let instruction_clone: DecodedInstruction<RaydiumLaunchpadInstruction> =
            instruction.clone();

        let start = std::time::Instant::now();

        let raw_instruction = match instruction.data {
            RaydiumLaunchpadInstruction::BuyExactIn(buy_exact_in_data) => {

                let account_length = instruction_clone.accounts.clone().len();
                let accounts = instruction_clone.accounts.clone();

                if let Some(mut arranged) =
                    BuyExactIn::arrange_accounts(&instruction_clone.accounts)
                {
                    arranged.payer = *PUBKEY;
                    arranged.user_base_token =
                        get_associated_token_address(&PUBKEY, &arranged.base_token_mint);
                    arranged.user_quote_token =
                        get_associated_token_address(&PUBKEY, &arranged.quote_token_mint);

                    let create_ata_ix = arranged.get_create_idempotent_ata_ix();

                    let inner_ixs: Vec<&InnerInstruction> = metadata
                        .transaction_metadata
                        .meta
                        .inner_instructions
                        .as_ref()
                        .expect("missing inner_instructions")
                        .iter()
                        .flat_map(|ixs| ixs.instructions.iter())
                        .filter(|inner_ix| {
                            // Get the program id index and check against RAY_LAUNCHPAD_PROGRAM_ID
                            let program_id_index = inner_ix.instruction.program_id_index as usize;
                            let program_id = account_keys
                                .get(program_id_index)
                                .expect("program id index out of bounds");

                            // Get the first account index
                            let first_account_index_opt = inner_ix.instruction.accounts.first();
                            if let Some(&first_account_index) = first_account_index_opt {
                                let first_account = account_keys
                                    .get(first_account_index as usize)
                                    .expect("account index out of bounds");

                                // Check the conditions
                                *program_id == RAY_LAUNCHPAD_PROGRAM_ID
                                    && *first_account == arranged.event_authority
                            } else {
                                false // no first account, so filter out
                            }
                        })
                        .collect();

                    let Some(swap_cpi_ix) = inner_ixs.last() else {
                        println!("No Swap Event found");
                        return Ok(()); // or Err(...) depending on your logic
                    };

                    println!("Sig : {}", signature.to_string());

                    let buy_param = BuyExactIn {
                        amount_in: BUY_SOL_AMOUNT.clone(),
                        minimum_amount_out: 0,
                        share_fee_rate: 0,
                    };

                    let account1 = accounts[account_length - 3].pubkey;
                    let account2 = accounts[account_length - 2].pubkey;
                    let account3 = accounts[account_length - 1].pubkey;

                    let buy_ix = arranged.get_buy_ix(buy_param.clone(), account1, account2, account3);

                    let mut instructions = vec![];
                    instructions.extend(create_ata_ix);
                    instructions.push(buy_ix);

                    instructions
                } else {
                    println!("Failed to arrange accounts");

                    vec![]
                }
            }
            _ => {
                vec![]
            }
        };

        if !raw_instruction.is_empty() {
            let (cu, priority_fee_micro_lamport, third_party_fee) = *PRIORITY_FEE;

            // Print current timestamp and consumed time from start
            println!(
                "Submitting tx --> Current time: {:#?}\nPeriod from start: {:?}",
                Utc::now(),
                start.elapsed()
            );

            let results = match CONFIRM_SERVICE.as_str() {
                "NOZOMI" => {
                    let nozomi = NOZOMI_CLIENT.get().expect("Nozomi client not initialized");

                    let ixs = nozomi.add_tip_ix(Tips {
                        cu: Some(cu),
                        priority_fee_micro_lamport: Some(priority_fee_micro_lamport),
                        payer: *PUBKEY,
                        pure_ix: raw_instruction.clone(),
                        tip_addr_idx: 1,
                        tip_sol_amount: third_party_fee,
                    });


                    let recent_blockhash = get_slot();

                    let encoded_tx = build_and_sign(ixs, recent_blockhash, None);

                    match nozomi.send_transaction(&encoded_tx).await {
                        Ok(data) => json!({ "result": data }),
                        Err(err) => {
                            json!({ "result": "error", "message": err.to_string() })
                        }
                    }
                }
                "ZERO_SLOT" => {
                    let zero_slot = ZSLOT_CLIENT.get().expect("ZSlot client not initialized");

                    let ixs = zero_slot.add_tip_ix(Tips {
                        cu: Some(cu),
                        priority_fee_micro_lamport: Some(priority_fee_micro_lamport),
                        payer: *PUBKEY,
                        pure_ix: raw_instruction,
                        tip_addr_idx: 1,
                        tip_sol_amount: third_party_fee,
                    });

                    let recent_blockhash = get_slot();

                    let encoded_tx = build_and_sign(ixs, recent_blockhash, None);

                    match zero_slot.send_transaction(&encoded_tx).await {
                        Ok(data) => json!({ "result": data }),
                        Err(err) => {
                            json!({ "result": "error", "message": err.to_string() })
                        }
                    }
                }
                "JITO" => {
                    let jito = JITO_CLIENT.get().expect("Jito client not initialized");

                    let ixs = jito.add_tip_ix(Tips {
                        cu: Some(cu),
                        priority_fee_micro_lamport: Some(priority_fee_micro_lamport),
                        payer: *PUBKEY,
                        pure_ix: raw_instruction,
                        tip_addr_idx: 1,
                        tip_sol_amount: third_party_fee,
                    });

                    let recent_blockhash = get_slot();

                    let encoded_tx = build_and_sign(ixs, recent_blockhash, None);

                    match jito.send_transaction(&encoded_tx).await {
                        Ok(data) => json!({ "result": data }),
                        Err(err) => {
                            json!({ "result": "error", "message": err.to_string() })
                        }
                    }
                }
                _ => {
                    json!({ "result": "error", "message": "unknown confirmation service" })
                }
            };

            // println!("Transaction confirmed --> : {:#?}\nCurrent time: {:#?}\nPeriod from start: {:?}", results, Utc::now(), start.elapsed());
            panic!(
                "Transaction confirmed --> : {:#?}\nCurrent time: {:#?}\nPeriod from start: {:?}",
                results,
                Utc::now(),
                start.elapsed()
            );
        };

        Ok(())
    }
}
