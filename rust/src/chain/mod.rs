mod contracts;

pub use contracts::{approve_tokens_after_buy, approve_usdc_allowance};


#[derive(Debug, Clone)]
pub struct ContractConfig {
    pub exchange: String,
    pub neg_risk_adapter: String,
    pub neg_risk_exchange: String,
    pub collateral: String,
    pub conditional_tokens: String,
}

pub fn get_contract_config(chain_id: u64) -> ContractConfig {
    match chain_id {
        137 => ContractConfig {
            exchange: "0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E".to_string(),
            neg_risk_adapter: "0xd91E80cF2E7be2e162c6513ceD06f1dD0dA35296".to_string(),
            neg_risk_exchange: "0xC5d563A36AE78145C45a50134d48A1215220f80a".to_string(),
            collateral: "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174".to_string(),
            conditional_tokens: "0x4D97DCd97eC945f40cF65F87097ACe5EA0476045".to_string(),
        },
        80002 => ContractConfig {
            exchange: "0xdFE02Eb6733538f8Ea35D585af8DE5958AD99E40".to_string(),
            neg_risk_adapter: "0xd91E80cF2E7be2e162c6513ceD06f1dD0dA35296".to_string(),
            neg_risk_exchange: "0xC5d563A36AE78145C45a50134d48A1215220f80a".to_string(),
            collateral: "0x9c4e1703476e875070ee25b56a58b008cfb8fa78".to_string(),
            conditional_tokens: "0x69308FB512518e39F9b16112fA8d994F4e2Bf8bB".to_string(),
        },
        _ => panic!("Unsupported chain ID: {}. Use 137 (Polygon) or 80002 (Amoy)", chain_id),
    }
}
