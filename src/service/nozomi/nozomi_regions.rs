use crate::service::NozomiEndpoint;

#[derive(Debug, PartialEq, Clone)]
pub enum NozomiRegionsType {
    PittDirect,
    TyoDirect,
    SgDirect,
    EwrDirect,
    AmsDirect,
    FraDirect,
    AmsSecure,
    TyoSecure,
    SgSecure,
    EwrSecure,
    PittSecure,
    FraSecure,
}

macro_rules! nozomi_endpoint {
    ($region:ident, $name:expr, $submit:expr, $ping:expr) => {
        NozomiEndpoint {
            relayer: NozomiRegionsType::$region,
            relayer_name: $name,
            submit_endpoint: $submit,
            ping_endpoint: $ping,
        }
    };
}

pub const NOZOMI_REGIONS: &[NozomiEndpoint] = &[
    nozomi_endpoint!(
        PittDirect,
        "Nozomi-PittDirect",
        "http://pit1.nozomi.temporal.xyz/?c=",
        "pit1.nozomi.temporal.xyz"
    ),
    nozomi_endpoint!(
        TyoDirect,
        "Nozomi-TyoDirect",
        "http://tyo1.nozomi.temporal.xyz/?c=",
        "tyo1.nozomi.temporal.xyz"
    ),
    nozomi_endpoint!(
        SgDirect,
        "Nozomi-SgDirect",
        "http://sgp1.nozomi.temporal.xyz/?c=",
        "sgp1.nozomi.temporal.xyz"
    ),
    nozomi_endpoint!(
        EwrDirect,
        "Nozomi-EwrDirect",
        "http://ewr1.nozomi.temporal.xyz/?c=",
        "ewr1.nozomi.temporal.xyz"
    ),
    nozomi_endpoint!(
        AmsDirect,
        "Nozomi-AmsDirect",
        "http://ams1.nozomi.temporal.xyz/?c=",
        "ams1.nozomi.temporal.xyz"
    ),
    nozomi_endpoint!(
        FraDirect,
        "Nozomi-FraDirect",
        "http://fra2.nozomi.temporal.xyz/?c=",
        "fra2.nozomi.temporal.xyz"
    ),
    nozomi_endpoint!(
        AmsSecure,
        "Nozomi-AmsSecure",
        "https://ams1.secure.nozomi.temporal.xyz/?c=",
        "ams1.secure.nozomi.temporal.xyz"
    ),
    nozomi_endpoint!(
        TyoSecure,
        "Nozomi-TyoSecure",
        "http://tyo1.secure.nozomi.temporal.xyz/?c=",
        "tyo1.secure.nozomi.temporal.xyz"
    ),
    nozomi_endpoint!(
        SgSecure,
        "Nozomi-SgSecure",
        "http://sgp1.secure.nozomi.temporal.xyz/?c=",
        "sgp1.secure.nozomi.temporal.xyz"
    ),
    nozomi_endpoint!(
        EwrSecure,
        "Nozomi-EwrSecure",
        "https://ewr1.secure.nozomi.temporal.xyz/?c=",
        "ewr1.secure.nozomi.temporal.xyz"
    ),
    nozomi_endpoint!(
        PittSecure,
        "Nozomi-PittSecure",
        "https://pit1.secure.nozomi.temporal.xyz/?c=",
        "pit1.secure.nozomi.temporal.xyz"
    ),
    nozomi_endpoint!(
        FraSecure,
        "Nozomi-FraSecure",
        "http://fra2.secure.nozomi.temporal.xyz/?c=",
        "fra2.secure.nozomi.temporal.xyz"
    ),
];
