use carbon_pumpfun_decoder::instructions::sell::{Sell, SellInstructionAccounts};
use solana_sdk::instruction::{AccountMeta, Instruction};

pub const EVENT_DISCRIMINATOR: [u8; 8] = [228, 69, 165, 46, 81, 203, 154, 29];

pub trait SellExactInInstructionAccountsExt {
    fn get_sell_ix(&self, sell_param: Sell) -> Instruction;
    fn get_close_ata_ix(&self) -> Instruction;
}

impl SellExactInInstructionAccountsExt for SellInstructionAccounts {
    fn get_close_ata_ix(&self) -> Instruction {
        let close_ata_ix = spl_token::instruction::close_account(
            &self.token_program,
            &self.associated_user,
            &self.user,
            &self.user,
            &[&self.user],
        )
        .unwrap();

        close_ata_ix
    }

    fn get_sell_ix(&self, sell_param: Sell) -> Instruction {
        let discriminator = [51, 230, 133, 164, 1, 127, 131, 173];
        let mut data = Vec::new();

        data.extend_from_slice(&discriminator);
        data.extend_from_slice(&sell_param.amount.to_le_bytes());
        data.extend_from_slice(&sell_param.min_sol_output.to_le_bytes());

        // Then encode the struct fields using Borsh

        let accounts = vec![
            AccountMeta::new_readonly(self.global, false),
            AccountMeta::new(self.fee_recipient, false),
            AccountMeta::new(self.mint, false),
            AccountMeta::new(self.bonding_curve, false),
            AccountMeta::new(self.associated_bonding_curve, false),
            AccountMeta::new(self.associated_user, false),
            AccountMeta::new(self.user, true),
            AccountMeta::new_readonly(self.system_program, false),
            AccountMeta::new(self.creator_vault, false),
            AccountMeta::new_readonly(self.token_program, false),
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
