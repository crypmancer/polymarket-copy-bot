use crate::service::JitoEndpoint;


#[derive(Debug, PartialEq, Clone)]
pub enum JitoRegionsType {
    Mainnet,
    Amsterdam,
    Frankfurt,
    London,
    NY,
    SLC,
    SG,
    Tokyo,
}

pub const JITO_REGIONS: &[JitoEndpoint] = &[
    JitoEndpoint {
        relayer: JitoRegionsType::Mainnet,
        relayer_name: "Jito-Mainnet",
        submit_endpoint: "https://mainnet.block-engine.jito.wtf/api/v1/transactions",
        ping_endpoint: "mainnet.block-engine.jito.wtf",
    },
    JitoEndpoint {
        relayer: JitoRegionsType::Amsterdam,
        relayer_name: "Jito-Amsterdam",
        submit_endpoint: "https://amsterdam.mainnet.block-engine.jito.wtf/api/v1/transactions",
        ping_endpoint: "amsterdam.mainnet.block-engine.jito.wtf",
    },
    JitoEndpoint {
        relayer: JitoRegionsType::Frankfurt,
        relayer_name: "Jito-Frankfurt",
        submit_endpoint: "https://frankfurt.mainnet.block-engine.jito.wtf/api/v1/transactions",
        ping_endpoint: "frankfurt.mainnet.block-engine.jito.wtf",
    },
    JitoEndpoint {
        relayer: JitoRegionsType::London,
        relayer_name: "Jito-London",
        submit_endpoint: "https://london.mainnet.block-engine.jito.wtf/api/v1/transactions",
        ping_endpoint: "london.mainnet.block-engine.jito.wtf",
    },
    JitoEndpoint {
        relayer: JitoRegionsType::NY,
        relayer_name: "Jito-NY",
        submit_endpoint: "https://ny.mainnet.block-engine.jito.wtf/api/v1/transactions",
        ping_endpoint: "ny.mainnet.block-engine.jito.wtf",
    },
    JitoEndpoint {
        relayer: JitoRegionsType::SLC,
        relayer_name: "Jito-SLC",
        submit_endpoint: "https://slc.mainnet.block-engine.jito.wtf/api/v1/transactions",
        ping_endpoint: "slc.mainnet.block-engine.jito.wtf",
    },
    JitoEndpoint {
        relayer: JitoRegionsType::SG,
        relayer_name: "Jito-SG",
        submit_endpoint: "https://singapore.mainnet.block-engine.jito.wtf/api/v1/transactions",
        ping_endpoint: "singapore.mainnet.block-engine.jito.wtf",
    },
    JitoEndpoint {
        relayer: JitoRegionsType::Tokyo,
        relayer_name: "Jito-Tokyo",
        submit_endpoint: "https://tokyo.mainnet.block-engine.jito.wtf/api/v1/transactions",
        ping_endpoint: "tokyo.mainnet.block-engine.jito.wtf",
    },
];
