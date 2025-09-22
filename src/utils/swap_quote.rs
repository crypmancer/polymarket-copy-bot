use std::ops::{Add, Div, Mul};

use crate::utils::calculate_fee;

pub const TRADE_FEE_RATE: u64 = 2500_u64;
pub const FEE_RATE: u64 = 10000_u64;

pub fn sol_token_quote(
    amount: u64,
    virtual_sol_reserves: u64,
    virtual_token_reserves: u64,
    is_buy: bool,
) -> u64 {
    let out_token_amount;
    if is_buy {
        out_token_amount = virtual_token_reserves as f64
            / (amount as f64 + virtual_sol_reserves as f64)
            * (amount as f64);
    } else {
        out_token_amount = virtual_token_reserves as f64
            / (amount as f64 + virtual_sol_reserves as f64 - 1.0)
            * (amount as f64 + 1.0);
    }

    out_token_amount as u64
}

pub fn token_sol_quote(
    amount: u64,
    virtual_sol_reserves: u64,
    virtual_token_reserves: u64,
    is_buy: bool,
) -> u64 {
    let out_sol_amount;
    if is_buy {
        out_sol_amount = amount as f64 / (virtual_token_reserves as f64 - amount as f64)
            * virtual_sol_reserves as f64;
    } else {
        out_sol_amount = amount as f64 / (virtual_token_reserves as f64 + amount as f64)
            * virtual_sol_reserves as f64;
    }

    out_sol_amount as u64
}

pub fn get_swap_quote(amount_in: u64, base_reserve: u64, quote_reserve: u64) -> u64 {
    let fee = calculate_fee(amount_in, TRADE_FEE_RATE + FEE_RATE);

    let amount_less_fee = amount_in - fee;

    let result = get_amount_out(
        amount_less_fee as u128,
        quote_reserve as u128,
        base_reserve as u128,
    );

    result as u64
}

pub fn get_amount_out(amount_in: u128, input_reserve: u128, output_reserve: u128) -> u128 {
    if input_reserve + amount_in == 0 {
        return 0;
    }

    let numerator = amount_in.mul(output_reserve);
    let denominator = input_reserve.add(amount_in);

    numerator.div(denominator)
}
