use carbon_raydium_launchpad_decoder::instructions::buy_exact_in::{
    BuyExactIn, BuyExactInInstructionAccounts,
};
use solana_program::example_mocks::solana_sdk::system_instruction;
use solana_sdk::{
    instruction::{AccountMeta, Instruction}, pubkey::Pubkey, signer::Signer
};
use spl_associated_token_account::get_associated_token_address;
use spl_token::instruction::sync_native;

use crate::{config::PUBKEY, utils::blockhash::WSOL};

pub const EVENT_DISCRIMINATOR: [u8; 8] = [189, 219, 127, 211, 78, 230, 97, 238];
pub trait BuyExactInInstructionAccountsExt {
    fn get_buy_ix(&self, buy_exact_in_param: BuyExactIn, account1: Pubkey, account2: Pubkey, account3: Pubkey) -> Instruction;
    fn get_create_idempotent_ata_ix(&self) -> Vec<Instruction>;
    fn get_create_ata_ix(&self) -> Instruction;
    fn get_wrap_sol(&self, buy_exact_in_param: BuyExactIn) -> Vec<Instruction>;
    fn get_close_wsol(&self) -> Instruction;
}

impl BuyExactInInstructionAccountsExt for BuyExactInInstructionAccounts {
    fn get_create_ata_ix(&self) -> Instruction {
        let create_ata_ix =
            spl_associated_token_account::instruction::create_associated_token_account(
                &self.payer,
                &self.payer,
                &self.base_token_mint,
                &self.base_token_program,
            );

        create_ata_ix
    }

    fn get_create_idempotent_ata_ix(&self) -> Vec<Instruction> {
        let create_ata_base_ix =
            spl_associated_token_account::instruction::create_associated_token_account_idempotent(
                &self.payer,
                &self.payer,
                &self.base_token_mint,
                &self.base_token_program,
            );

        let create_ata_quote_ix =
            spl_associated_token_account::instruction::create_associated_token_account_idempotent(
                &self.payer,
                &self.payer,
                &self.quote_token_mint,
                &self.quote_token_program,
            );

        vec![create_ata_base_ix, create_ata_quote_ix]
    }

    fn get_wrap_sol(&self, buy_exact_in_param: BuyExactIn) -> Vec<Instruction> {
        let wsol_ata = get_associated_token_address(&PUBKEY, &WSOL);
        let transfer_ix =
            system_instruction::transfer(&PUBKEY, &wsol_ata, buy_exact_in_param.amount_in);
        let wrap_ix = sync_native(&spl_token::ID, &wsol_ata).unwrap();

        vec![transfer_ix, wrap_ix]
    }

    fn get_close_wsol(&self) -> Instruction {
        let wsol_ata = get_associated_token_address(&PUBKEY, &WSOL);

        let create_ata_ix = spl_token::instruction::close_account(
            &spl_token::ID,
            &wsol_ata,
            &PUBKEY,
            &PUBKEY,
            &[],
        )
        .unwrap();

        create_ata_ix
    }

    fn get_buy_ix(&self, buy_exact_in_param: BuyExactIn, account1: Pubkey, account2: Pubkey, account3: Pubkey) -> Instruction {
        let discriminator = [250, 234, 13, 123, 213, 156, 19, 236];
        let mut data = Vec::new();

        data.extend_from_slice(&discriminator);
        data.extend_from_slice(&buy_exact_in_param.amount_in.to_le_bytes());
        data.extend_from_slice(&buy_exact_in_param.minimum_amount_out.to_le_bytes());
        data.extend_from_slice(&buy_exact_in_param.share_fee_rate.to_le_bytes());

        // Then encode the struct fields using Borsh

        let accounts = vec![
            AccountMeta::new(self.payer, true),
            AccountMeta::new_readonly(self.authority, false),
            AccountMeta::new_readonly(self.global_config, false),
            AccountMeta::new_readonly(self.platform_config, false),
            AccountMeta::new(self.pool_state, false),
            AccountMeta::new(self.user_base_token, false),
            AccountMeta::new(self.user_quote_token, false),
            AccountMeta::new(self.base_vault, false),
            AccountMeta::new(self.quote_vault, false),
            AccountMeta::new_readonly(self.base_token_mint, false),
            AccountMeta::new_readonly(self.quote_token_mint, false),
            AccountMeta::new_readonly(self.base_token_program, false),
            AccountMeta::new_readonly(self.quote_token_program, false),
            AccountMeta::new_readonly(self.event_authority, false),
            AccountMeta::new_readonly(self.program, false),
            AccountMeta::new_readonly(account1, false),
            AccountMeta::new(account2, false),
            AccountMeta::new(account3, false),
        ];

        Instruction {
            program_id: self.program,
            accounts,
            data,
        }
    }
}
