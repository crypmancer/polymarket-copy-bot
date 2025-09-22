use borsh::{BorshDeserialize, BorshSerialize};
use carbon_core::{CarbonDeserialize, borsh};
use solana_sdk::pubkey::Pubkey;
use solana_transaction_status_client_types::TransactionTokenBalance;
use yellowstone_grpc_proto::prelude::{Message, TransactionStatusMeta};

pub fn get_pre_post_token_balance(
    pre_token_balance: Vec<TransactionTokenBalance>,
    post_token_balance: Vec<TransactionTokenBalance>,
    pool_addr: &str,
    token_mint: &str,
) -> (u64, u64) {
    let extract_amount = |balances: &[TransactionTokenBalance]| {
        balances
            .iter()
            .find(|tb| tb.owner == pool_addr && tb.mint == token_mint)
            .and_then(|tb| Some(tb.ui_token_amount.clone()))
            .and_then(|ui| ui.amount.parse::<u64>().ok())
            .unwrap_or(0)
    };

    let pre_amount = extract_amount(&pre_token_balance);
    let post_amount = extract_amount(&post_token_balance);

    (pre_amount, post_amount)
}

pub const TRADE_EVENT_DISC: [u8; 8] = [189, 219, 127, 211, 78, 230, 97, 238];


pub fn get_signers(tx_msg: &Message) -> (usize, Vec<Pubkey>) {
    let signer_count = tx_msg
        .header
        .map(|header| header.num_required_signatures as usize)
        .unwrap_or(0);

    let pubkeys: Vec<Pubkey> = tx_msg
        .account_keys
        .iter()
        .filter_map(|key_bytes| Pubkey::try_from(key_bytes.as_slice()).ok())
        .collect();

    let signer_pubkeys = &pubkeys[..signer_count.min(pubkeys.len())];

    (signer_count, signer_pubkeys.to_vec())
}
