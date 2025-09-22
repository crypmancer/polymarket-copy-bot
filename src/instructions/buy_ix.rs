use carbon_pumpfun_decoder::instructions::buy::{Buy, BuyInstructionAccounts};
use solana_sdk::{instruction::{AccountMeta, Instruction}, pubkey::Pubkey};

pub const EVENT_DISCRIMINATOR: [u8; 8] = [228, 69, 165, 46, 81, 203, 154, 29];

pub trait BuyExactInInstructionAccountsExt {
    fn get_buy_ix(&self, buy_exact_in_param: Buy) -> Instruction;
    fn get_create_idempotent_ata_ix(&self) -> Instruction;
    fn get_create_ata_ix(&self) -> Instruction;
    fn global_volume_accumulator_pda() -> Pubkey;
    fn user_volume_accumulator_pda(user: &Pubkey) -> Pubkey;
}

impl BuyExactInInstructionAccountsExt for BuyInstructionAccounts {
    fn get_create_ata_ix(&self) -> Instruction {
        let create_ata_ix =
            spl_associated_token_account::instruction::create_associated_token_account(
                &self.user,
                &self.user,
                &self.mint,
                &self.token_program,
            );

        create_ata_ix
    }

    fn get_create_idempotent_ata_ix(&self) -> Instruction {
        let create_ata_base_ix =
            spl_associated_token_account::instruction::create_associated_token_account_idempotent(
                &self.user,
                &self.user,
                &self.mint,
                &self.token_program,
            );

        create_ata_base_ix
    }

    fn get_buy_ix(&self, buy_exact_in_param: Buy) -> Instruction {
        let discriminator = [102, 6, 61, 18, 1, 218, 235, 234];
        let mut data = Vec::new();

        data.extend_from_slice(&discriminator);
        data.extend_from_slice(&buy_exact_in_param.amount.to_le_bytes());
        data.extend_from_slice(&buy_exact_in_param.max_sol_cost.to_le_bytes());

        let global_volume_accumulator = Self::global_volume_accumulator_pda();
        let user_volume_accumulator = Self::user_volume_accumulator_pda(&self.user);

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
            AccountMeta::new_readonly(self.token_program, false),
            AccountMeta::new(self.creator_vault, false),
            AccountMeta::new_readonly(self.event_authority, false),
            AccountMeta::new_readonly(self.program, false),
            AccountMeta::new(global_volume_accumulator, false),
            AccountMeta::new(user_volume_accumulator, false),
        ];

        Instruction {
            program_id: self.program,
            accounts,
            data,
        }
    }

    // Pump program
    fn global_volume_accumulator_pda() -> Pubkey {
        let (global_volume_accumulator, _bump) = Pubkey::find_program_address(
            &[b"global_volume_accumulator"],
            &Pubkey::from_str_const("6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P"),
        );
        global_volume_accumulator
    }

    fn user_volume_accumulator_pda(user: &Pubkey) -> Pubkey {
        let (user_volume_accumulator, _bump) = Pubkey::find_program_address(
            &[b"user_volume_accumulator", user.as_ref()],
            &Pubkey::from_str_const("6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P"),
        );
        user_volume_accumulator
    }
}
