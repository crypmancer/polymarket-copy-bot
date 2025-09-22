use crate::service::{JitoRegionsType, NozomiRegionsType, ZSlotRegionsType};

#[derive(Debug, Clone)]
pub struct NozomiEndpoint {
    pub relayer: NozomiRegionsType,
    pub submit_endpoint: &'static str,
    pub ping_endpoint: &'static str,
    pub relayer_name: &'static str,
}

#[derive(Debug, Clone)]
pub struct ZSlotEndpoint {
    pub relayer: ZSlotRegionsType,
    pub submit_endpoint: &'static str,
    pub ping_endpoint: &'static str,
    pub relayer_name: &'static str,
}

#[derive(Debug, Clone)]
pub struct JitoEndpoint {
    pub relayer: JitoRegionsType,
    pub submit_endpoint: &'static str,
    pub ping_endpoint: &'static str,
    pub relayer_name: &'static str,
}