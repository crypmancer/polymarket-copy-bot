use solana_sdk::{instruction::Instruction, pubkey::Pubkey};

#[derive(Debug, Clone)]
pub struct Tips {
    pub tip_sol_amount: f64,
    pub tip_addr_idx: u8,
    pub cu: Option<u64>,
    pub priority_fee_micro_lamport: Option<u64>,
    pub payer: Pubkey,
    pub pure_ix: Vec<Instruction>,
}
