use std::{
    net::ToSocketAddrs,
    time::{Duration, Instant},
};

use futures::future::join_all;
use ping::ping;

pub const PING_DURATION_SEC : u64 = 2;
pub const HEALTH_CHECK_SEC : u64 = 2;

pub async fn ping_one(
    name: String,
    host: String,
    ping_duration: u64,
) -> Result<f64, String> {
    let timeout = Duration::from_secs(ping_duration);
    let ident = 0xABCD;

    // Resolve hostname to IP
    let ip = match (host, 0)
        .to_socket_addrs()
        .ok()
        .and_then(|mut iter| iter.next())
    {
        Some(addr) => addr.ip(),
        None => {
            return Err(format!("{}: Failed to resolve hostname", name));
        }
    };

    // Measure RTT
    let start = Instant::now();
    let result = ping(
        ip,
        Some(timeout),
        Some(64),
        Some(ident),
        Some(1),
        Some(&[0; 24]),
    );
    let elapsed = start.elapsed();

    match result {
        Ok(_) => {
            let rtt = elapsed.as_secs_f64() * 1000.0;
            println!("{:<30} {:<30} {:>8.3} ms", name, format!("({})", ip), rtt);
            Ok(rtt)
        }
        Err(err) => Err(format!("{} ({}): Ping failed: {}", name, ip, err)),
    }
}

pub async fn ping_all(
    regions: Vec<(String, String)>,
    ping_duration: u64,
) -> Option<usize> {
    let timeout = Duration::from_secs(ping_duration);
    let ident = 0xABCD;

    let futures = regions
        .into_iter()
        .enumerate()
        .map(|(i, (name, host))| async move {
            // Resolve hostname to IP
            let ip = match (host, 0)
                .to_socket_addrs()
                .ok()
                .and_then(|mut iter| iter.next())
            {
                Some(addr) => addr.ip(),
                None => {
                    println!(
                        "{:<12} {:<17} {}",
                        name, "N/A", "Failed to resolve hostname"
                    );
                    return (i, None);
                }
            };

            // Measure RTT
            let start = Instant::now();
            let result = ping(
                ip,
                Some(timeout),
                Some(64),
                Some(ident),
                Some(1),
                Some(&[0; 24]),
            );
            let elapsed = start.elapsed();

            match result {
                Ok(_) => {
                    println!(
                        "{:<30} {:<30} {:>8.3} ms",
                        name,
                        format!("({})", ip),
                        elapsed.as_secs_f64() * 1000.0
                    );
                    (i, Some(elapsed))
                }
                Err(err) => {
                    println!(
                        "{:<30} {:<30} {}",
                        name,
                        format!("({})", ip),
                        format!("Ping failed: {}", err)
                    );
                    (i, None)
                }
            }
        });

    let results = join_all(futures).await;

    // Find the index with the shortest ping time
    results
        .into_iter()
        .filter_map(|(i, time)| time.map(|t| (i, t)))
        .min_by_key(|&(_, duration)| duration)
        .map(|(i, _)| i)
}
