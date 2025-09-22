pub fn ceil_div(token_amount: u128, fee_numerator: u128, fee_denominator: u128) -> Option<u128> {
    token_amount
        .checked_mul(u128::from(fee_numerator))
        .unwrap()
        .checked_add(fee_denominator)?
        .checked_sub(1)?
        .checked_div(fee_denominator)
}

pub const FEE_RATE_DENOMINATOR_VALUE: u64 = 1_000_000_u64;

pub fn get_trade_fee(amm_config_addr: &str) -> u128 {
    match amm_config_addr {
        "B5u5x9S5pyaJdonf7bXUiEnBfEXsJWhNxXfLGAbRFtg2" => 15000,
        "C7Cx2pMLtjybS3mDKSfsBj4zQ3PRZGkKt7RCYTTbCSx2" => 40000,
        "BgxH5ifebqHDuiADWKhLjXGP5hWZeZLoCdmeWJLkRqLP" => 3000,
        "BhH6HphjBKXu2PkUc2aw3xEMdUvK14NXxE5LbNWZNZAA" => 5000,
        "G95xxie3XbkCqtE39GgQ9Ggc7xBC8Uceve7HFDEFApkc" => 10000,
        "D4FPEruKEHrG5TenZ2mpDGEfu1iUvTiqBxvpU8HLBvC2" => 2500,
        "2fGXL8uhqxJ4tpgtosHZXT4zcQap6j62z3bMDxdkMvy5" => 20000,
        _ => 0,
    }
}

pub fn calculate_fee(amount: u64, fee_rate: u64) -> u64 {
    ceil_div_ray(amount, fee_rate, FEE_RATE_DENOMINATOR_VALUE)
}

pub fn ceil_div_ray(token_amount: u64, fee_numerator: u64, fee_denominator: u64) -> u64 {
    if fee_denominator == 0 {
        panic!("Division by zero");
    }

    (token_amount
        .saturating_mul(fee_numerator)
        .saturating_add(fee_denominator - 1))
        / fee_denominator
}
