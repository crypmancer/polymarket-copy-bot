import { readFileSync, writeFileSync, existsSync } from "fs";
import { resolve } from "path";
import { logger } from "./logger";

/**
 * Holdings structure: market_id (conditionId) -> { token_id: amount }
 */
export interface TokenHoldings {
    [marketId: string]: {
        [tokenId: string]: number;
    };
}

const HOLDINGS_FILE = resolve(process.cwd(), "src/data/token-holding.json");

/**
 * Load holdings from file
 */
export function loadHoldings(): TokenHoldings {
    if (!existsSync(HOLDINGS_FILE)) {
        return {};
    }

    try {
        const content = readFileSync(HOLDINGS_FILE, "utf-8");
        return JSON.parse(content) as TokenHoldings;
    } catch (error) {
        logger.error("Failed to load holdings", error);
        return {};
    }
}

/**
 * Save holdings to file
 */
export function saveHoldings(holdings: TokenHoldings): void {
    try {
        writeFileSync(HOLDINGS_FILE, JSON.stringify(holdings, null, 2));
    } catch (error) {
        logger.error("Failed to save holdings", error);
    }
}

/**
 * Add tokens to holdings after a BUY order
 */
export function addHoldings(marketId: string, tokenId: string, amount: number): void {
    const holdings = loadHoldings();
    
    if (!holdings[marketId]) {
        holdings[marketId] = {};
    }
    
    if (!holdings[marketId][tokenId]) {
        holdings[marketId][tokenId] = 0;
    }
    
    holdings[marketId][tokenId] += amount;
    
    saveHoldings(holdings);
    logger.info(`Added ${amount} tokens to holdings: ${marketId} -> ${tokenId}`);
}

/**
 * Get holdings for a specific token
 */
export function getHoldings(marketId: string, tokenId: string): number {
    const holdings = loadHoldings();
    return holdings[marketId]?.[tokenId] || 0;
}

/**
 * Remove tokens from holdings after a SELL order
 */
export function removeHoldings(marketId: string, tokenId: string, amount: number): void {
    const holdings = loadHoldings();
    
    if (!holdings[marketId] || !holdings[marketId][tokenId]) {
        logger.warning(`No holdings found for ${marketId} -> ${tokenId}`);
        return;
    }
    
    const currentAmount = holdings[marketId][tokenId];
    const newAmount = Math.max(0, currentAmount - amount);
    
    if (newAmount === 0) {
        delete holdings[marketId][tokenId];
        // Clean up empty market entries
        if (Object.keys(holdings[marketId]).length === 0) {
            delete holdings[marketId];
        }
    } else {
        holdings[marketId][tokenId] = newAmount;
    }
    
    saveHoldings(holdings);
    logger.info(`Removed ${amount} tokens from holdings: ${marketId} -> ${tokenId} (remaining: ${newAmount})`);
}

/**
 * Get all holdings for a market
 */
export function getMarketHoldings(marketId: string): { [tokenId: string]: number } {
    const holdings = loadHoldings();
    return holdings[marketId] || {};
}

/**
 * Get all holdings (for debugging/viewing)
 */
export function getAllHoldings(): TokenHoldings {
    return loadHoldings();
}

/**
 * Clear all holdings for a specific market
 */
export function clearMarketHoldings(marketId: string): void {
    const holdings = loadHoldings();
    if (holdings[marketId]) {
        delete holdings[marketId];
        saveHoldings(holdings);
        logger.info(`Cleared holdings for market: ${marketId}`);
    } else {
        logger.warning(`No holdings found for market: ${marketId}`);
    }
}

/**
 * Clear all holdings (use with caution)
 */
export function clearHoldings(): void {
    saveHoldings({});
    logger.info("All holdings cleared");
}

