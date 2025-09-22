use crate::service::ZSlotEndpoint;

#[derive(Debug, PartialEq, Clone)]
pub enum ZSlotRegionsType {
    Frankfurt,
    NewYork,
    AMS,
    LA,
    Tokyo,
}

macro_rules! zslot_endpoint {
    ($region:ident, $name:expr, $submit:expr, $ping:expr) => {
        ZSlotEndpoint {
            relayer: ZSlotRegionsType::$region,
            relayer_name: $name,
            submit_endpoint: $submit,
            ping_endpoint: $ping,
        }
    };
}

pub const ZSLOT_REGIONS: &[ZSlotEndpoint] = &[
    zslot_endpoint!(
        NewYork,
        "ZeroSlot-NewYork",
        "https://ny.0slot.trade?api-key=",
        "ny.0slot.trade"
    ),
    zslot_endpoint!(
        Frankfurt,
        "ZeroSlot-Frankfurt",
        "https://de.0slot.trade?api-key=",
        "de.0slot.trade"
    ),
    zslot_endpoint!(
        AMS,
        "ZeroSlot-AMS",
        "https://ams.0slot.trade?api-key=",
        "ams.0slot.trade"
    ),
    zslot_endpoint!(
        LA,
        "ZeroSlot-LA",
        "https://la.0slot.trade?api-key=",
        "la.0slot.trade"
    ),
    zslot_endpoint!(
        Tokyo,
        "ZeroSlot-Tokyo",
        "https://jp.0slot.trade?api-key=",
        "jp.0slot.trade"
    ),
];
