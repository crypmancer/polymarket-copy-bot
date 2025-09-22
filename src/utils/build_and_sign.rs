use solana_sdk::{
    hash::Hash,
    instruction::Instruction,
    message::{VersionedMessage, v0::Message},
    transaction::VersionedTransaction,
};

use crate::config::{PRIVATE_KEY, PUBKEY};

pub fn build_and_sign(
    mut ixs: Vec<Instruction>,
    recent_blockhash: Hash,
    nonce_ix: Option<Instruction>,
) -> String {
    // If there's a nonce instruction, insert it at the start of the instruction list
    if let Some(nonce_instruction) = nonce_ix {
        ixs.insert(0, nonce_instruction);
    }

    let message = Message::try_compile(&PUBKEY, &ixs, &[], recent_blockhash)
        .expect("Failed to compile message");
    let versioned_message = VersionedMessage::V0(message);
    let txn = VersionedTransaction::try_new(versioned_message, &[&PRIVATE_KEY])
        .expect("Failed to create transaction");

    let serialized_tx = bincode::serialize(&txn).expect("Failed to serialize transaction");

    bs64::encode(&serialized_tx)
}
