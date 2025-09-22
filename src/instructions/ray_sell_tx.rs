use carbon_raydium_launchpad_decoder::instructions::sell_exact_in::{
    SellExactIn, SellExactInInstructionAccounts,
};
use solana_sdk::{
    instruction::{AccountMeta, Instruction},
    signer::Signer,
};
use spl_associated_token_account::get_associated_token_address;

use crate::{config::PUBKEY, utils::blockhash::WSOL};

pub trait SellExactInInstructionAccountsExt {
    fn get_sell_ix(&self, sell_exact_in_param: SellExactIn) -> Instruction;
    fn get_close_wsol(&self) -> Instruction;
    fn get_create_idempotent_ata_ix(&self) -> Vec<Instruction>;
}
impl SellExactInInstructionAccountsExt for SellExactInInstructionAccounts {
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

    fn get_sell_ix(&self, sell_exact_in_param: SellExactIn) -> Instruction {
        let discriminator = [149, 39, 222, 155, 211, 124, 152, 26];
        let mut data = Vec::new();

        data.extend_from_slice(&discriminator);
        data.extend_from_slice(&sell_exact_in_param.amount_in.to_le_bytes());
        data.extend_from_slice(&sell_exact_in_param.minimum_amount_out.to_le_bytes());
        data.extend_from_slice(&sell_exact_in_param.share_fee_rate.to_le_bytes());

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
        ];

        Instruction {
            program_id: self.program,
            accounts,
            data,
        }
    }
}
