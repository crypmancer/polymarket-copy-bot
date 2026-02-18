import { RealTimeDataClient, type RealTimeDataClientArgs } from "@polymarket/real-time-data-client";

const DEFAULT_HOST = "wss://ws-live-data.polymarket.com";
const DEFAULT_PING_INTERVAL = 5000;

/**
 * Get a RealTimeDataClient instance with optional callbacks.
 * @param args - Configuration options including callbacks for the client.
 * @returns A RealTimeDataClient instance.
 */
export function getRealTimeDataClient(args?: RealTimeDataClientArgs): RealTimeDataClient {
    return new RealTimeDataClient({
        host: process.env.USER_REAL_TIME_DATA_URL || DEFAULT_HOST,
        pingInterval: DEFAULT_PING_INTERVAL,
        ...args,
    });
}
