#!/usr/bin/env bun
/**
 * Standalone script to redeem positions for resolved markets
 * 
 * Usage:
 *   bun src/redeem.ts <conditionId> [indexSets...]
 *   bun src/redeem.ts 0x5f65177b394277fd294cd75650044e32ba009a95022d88a0c1d565897d72f8f1 1 2
 * 
 * Or set CONDITION_ID and INDEX_SETS in .env file
 */

import { redeemPositions, redeemMarket } from "./utils/redeem";
import { getAllHoldings, getMarketHoldings } from "./utils/holdings";
import { logger } from "./utils/logger";
import { resolve } from "path";
import { config as dotenvConfig } from "dotenv";

dotenvConfig({ path: resolve(process.cwd(), ".env") });

async function main() {
    const args = process.argv.slice(2);

    // Get condition ID from args or env
    let conditionId: string | undefined;
    let indexSets: number[] | undefined;

    if (args.length > 0) {
        conditionId = args[0];
        if (args.length > 1) {
            indexSets = args.slice(1).map(arg => parseInt(arg, 10));
        }
    } else {
        conditionId = process.env.CONDITION_ID;
        const indexSetsEnv = process.env.INDEX_SETS;
        if (indexSetsEnv) {
            indexSets = indexSetsEnv.split(",").map(s => parseInt(s.trim(), 10));
        }
    }

    // If no conditionId provided, show holdings and prompt
    if (!conditionId) {
        logger.info("No condition ID provided. Showing current holdings...");
        const holdings = getAllHoldings();
        
        if (Object.keys(holdings).length === 0) {
            logger.warning("No holdings found.");
            logger.info("\nUsage:");
            logger.info("  bun src/redeem.ts <conditionId> [indexSets...]");
            logger.info("  bun src/redeem.ts 0x5f65177b394277fd294cd75650044e32ba009a95022d88a0c1d565897d72f8f1 1 2");
            logger.info("\nOr set in .env:");
            logger.info("  CONDITION_ID=0x5f65177b394277fd294cd75650044e32ba009a95022d88a0c1d565897d72f8f1");
            logger.info("  INDEX_SETS=1,2");
            process.exit(1);
        }

        logger.info("\nCurrent Holdings:");
        for (const [marketId, tokens] of Object.entries(holdings)) {
            logger.info(`  Market: ${marketId}`);
            for (const [tokenId, amount] of Object.entries(tokens)) {
                logger.info(`    Token ${tokenId.substring(0, 20)}...: ${amount}`);
            }
        }
        logger.info("\nTo redeem a market, provide the conditionId (market ID) as an argument.");
        logger.info("Example: bun src/redeem.ts <conditionId>");
        process.exit(0);
    }

    // Default to [1, 2] for Polymarket binary markets if not specified
    if (!indexSets || indexSets.length === 0) {
        logger.info("No index sets specified, using default [1, 2] for Polymarket binary markets");
        indexSets = [1, 2];
    }

    // Show holdings for this market if available
    const marketHoldings = getMarketHoldings(conditionId);
    if (Object.keys(marketHoldings).length > 0) {
        logger.info(`\nHoldings for market ${conditionId}:`);
        for (const [tokenId, amount] of Object.entries(marketHoldings)) {
            logger.info(`  Token ${tokenId.substring(0, 20)}...: ${amount}`);
        }
    } else {
        logger.warning(`No holdings found for market ${conditionId}`);
    }

    try {
        logger.info(`\nRedeeming positions for condition: ${conditionId}`);
        logger.info(`Index Sets: ${indexSets.join(", ")}`);

        // Use the simple redeemMarket function
        const receipt = await redeemMarket(conditionId);

        logger.success("\n✅ Successfully redeemed positions!");
        logger.info(`Transaction hash: ${receipt.transactionHash}`);
        logger.info(`Block number: ${receipt.blockNumber}`);
        logger.info(`Gas used: ${receipt.gasUsed.toString()}`);

        // Automatically clear holdings after successful redemption
        try {
            const { clearMarketHoldings } = await import("./utils/holdings");
            clearMarketHoldings(conditionId);
            logger.info(`\n✅ Cleared holdings record for this market from token-holding.json`);
        } catch (clearError) {
            logger.warning(`Failed to clear holdings: ${clearError instanceof Error ? clearError.message : String(clearError)}`);
            // Don't fail if clearing holdings fails
        }
    } catch (error) {
        logger.error("\n❌ Failed to redeem positions:", error);
        if (error instanceof Error) {
            logger.error(`Error message: ${error.message}`);
        }
        process.exit(1);
    }
}

main().catch((error) => {
    logger.error(`Fatal error: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
});

