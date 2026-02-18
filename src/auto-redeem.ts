#!/usr/bin/env bun
/**
 * Automated redemption script for resolved Polymarket markets
 * 
 * This script:
 * 1. Checks all markets in your holdings
 * 2. Identifies which markets are resolved
 * 3. Automatically redeems resolved markets
 * 
 * Usage:
 *   bun src/auto-redeem.ts                    # Check and redeem all resolved markets (from holdings file)
 *   bun src/auto-redeem.ts --api               # Fetch all markets from API and redeem winning positions
 *   bun src/auto-redeem.ts --dry-run          # Check but don't redeem (preview only)
 *   bun src/auto-redeem.ts --clear-holdings   # Clear holdings after successful redemption
 *   bun src/auto-redeem.ts --check <conditionId>  # Check if a specific market is resolved
 */

import { resolve } from "path";
import { config as dotenvConfig } from "dotenv";
import { 
    autoRedeemResolvedMarkets, 
    isMarketResolved, 
    redeemMarket, 
    getUserTokenBalances,
    redeemAllWinningMarketsFromAPI 
} from "./utils/redeem";
import { logger } from "./utils/logger";
import { getAllHoldings } from "./utils/holdings";

dotenvConfig({ path: resolve(process.cwd(), ".env") });

async function main() {
    const args = process.argv.slice(2);
    
    // Check for specific condition ID
    const checkIndex = args.indexOf("--check");
    if (checkIndex !== -1 && args[checkIndex + 1]) {
        const conditionId = args[checkIndex + 1];
        logger.info(`\n=== Checking Market Status ===`);
        logger.info(`Condition ID: ${conditionId}`);
        
        const { isResolved, market, reason, winningIndexSets } = await isMarketResolved(conditionId);
        
        if (isResolved) {
            logger.success(`✅ Market is RESOLVED and ready for redemption!`);
            logger.info(`Outcome: ${market?.outcome || "N/A"}`);
            if (winningIndexSets && winningIndexSets.length > 0) {
                logger.info(`Winning outcomes: ${winningIndexSets.join(", ")}`);
            }
            logger.info(`Reason: ${reason}`);
            
            // Check user's holdings
            try {
                const privateKey = process.env.PRIVATE_KEY;
                if (privateKey) {
                    const { Wallet } = await import("@ethersproject/wallet");
                    const wallet = new Wallet(privateKey);
                    const balances = await getUserTokenBalances(conditionId, await wallet.getAddress());
                    
                    if (balances.size > 0) {
                        logger.info("\nYour token holdings:");
                        for (const [indexSet, balance] of balances.entries()) {
                            const isWinner = winningIndexSets?.includes(indexSet);
                            const status = isWinner ? "✅ WINNER" : "❌ Loser";
                            logger.info(`  IndexSet ${indexSet}: ${balance.toString()} tokens ${status}`);
                        }
                        
                        const winningHeld = Array.from(balances.keys()).filter(idx => 
                            winningIndexSets?.includes(idx)
                        );
                        if (winningHeld.length > 0) {
                            logger.success(`\nYou hold winning tokens! (IndexSets: ${winningHeld.join(", ")})`);
                        } else {
                            logger.warning("\n⚠️  You don't hold any winning tokens for this market.");
                        }
                    }
                }
            } catch (error) {
                // Ignore balance check errors
            }
            
            // Ask if user wants to redeem
            const shouldRedeem = args.includes("--redeem");
            if (shouldRedeem) {
                logger.info("\nRedeeming market...");
                try {
                    const receipt = await redeemMarket(conditionId);
                    logger.success(`✅ Successfully redeemed!`);
                    logger.info(`Transaction: ${receipt.transactionHash}`);
                } catch (error) {
                    logger.error(`Failed to redeem: ${error instanceof Error ? error.message : String(error)}`);
                    process.exit(1);
                }
            } else {
                logger.info("\nTo redeem this market, run:");
                logger.info(`  bun src/auto-redeem.ts --check ${conditionId} --redeem`);
            }
        } else {
            logger.warning(`❌ Market is NOT resolved`);
            logger.info(`Reason: ${reason}`);
        }
        return;
    }
    
    // Check for flags
    const dryRun = args.includes("--dry-run");
    const clearHoldings = args.includes("--clear-holdings");
    const useAPI = args.includes("--api");
    
    if (dryRun) {
        logger.info("\n=== DRY RUN MODE: No actual redemptions will be performed ===\n");
    }
    
    // Use API method if --api flag is set
    if (useAPI) {
        logger.info("\n=== USING POLYMARKET API METHOD ===");
        logger.info("Fetching all markets from API and checking for winning positions...\n");
        
        const maxMarkets = args.includes("--max") 
            ? parseInt(args[args.indexOf("--max") + 1]) || 1000
            : 1000;
        
        const result = await redeemAllWinningMarketsFromAPI({
            maxMarkets,
            dryRun,
        });
        
        // Print summary
        logger.info("\n" + "=".repeat(50));
        logger.info("API REDEMPTION SUMMARY");
        logger.info("=".repeat(50));
        logger.info(`Total markets checked: ${result.totalMarketsChecked}`);
        logger.info(`Markets where you have positions: ${result.marketsWithPositions}`);
        logger.info(`Resolved markets: ${result.resolved}`);
        logger.info(`Markets with winning tokens: ${result.withWinningTokens}`);
        
        if (dryRun) {
            logger.info(`Would redeem: ${result.withWinningTokens} market(s)`);
        } else {
            logger.success(`Successfully redeemed: ${result.redeemed} market(s)`);
            if (result.failed > 0) {
                logger.warning(`Failed: ${result.failed} market(s)`);
            }
        }
        
        // Show detailed results for markets with winning tokens
        if (result.withWinningTokens > 0) {
            logger.info("\nDetailed Results (Markets with Winning Tokens):");
            for (const res of result.results) {
                if (res.hasWinningTokens) {
                    const title = res.marketTitle ? `"${res.marketTitle.substring(0, 50)}..."` : res.conditionId.substring(0, 20) + "...";
                    if (res.redeemed) {
                        logger.success(`  ✅ ${title} - Redeemed`);
                    } else {
                        logger.error(`  ❌ ${title} - Failed: ${res.error || "Unknown error"}`);
                    }
                }
            }
        }
        
        if (result.withWinningTokens === 0 && !dryRun) {
            logger.info("\nNo resolved markets with winning tokens found.");
        }
        
        return;
    }
    
    // Default: Use holdings file method
    logger.info("\n=== USING HOLDINGS FILE METHOD ===");
    
    // Get all holdings
    const holdings = getAllHoldings();
    const marketCount = Object.keys(holdings).length;
    
    if (marketCount === 0) {
        logger.warning("No holdings found in token-holding.json. Nothing to redeem.");
        logger.info("\nOptions:");
        logger.info("  1. Holdings are tracked automatically when you place orders");
        logger.info("  2. Use --api flag to fetch all markets from Polymarket API instead");
        logger.info("     Example: bun src/auto-redeem.ts --api");
        process.exit(0);
    }
    
    logger.info(`\nFound ${marketCount} market(s) in holdings`);
    logger.info("Checking which markets are resolved...\n");
    
    // Run auto-redemption
    const result = await autoRedeemResolvedMarkets({
        dryRun,
        clearHoldingsAfterRedeem: clearHoldings,
    });
    
    // Print summary
    logger.info("\n" + "=".repeat(50));
    logger.info("REDEMPTION SUMMARY");
    logger.info("=".repeat(50));
    logger.info(`Total markets checked: ${result.total}`);
    logger.info(`Resolved markets: ${result.resolved}`);
    
    if (dryRun) {
        logger.info(`Would redeem: ${result.resolved} market(s)`);
    } else {
        logger.success(`Successfully redeemed: ${result.redeemed} market(s)`);
        if (result.failed > 0) {
            logger.warning(`Failed: ${result.failed} market(s)`);
        }
    }
    
    // Show detailed results
    if (result.resolved > 0 || result.failed > 0) {
        logger.info("\nDetailed Results:");
        for (const res of result.results) {
            if (res.isResolved) {
                if (res.redeemed) {
                    logger.success(`  ✅ ${res.conditionId.substring(0, 20)}... - Redeemed`);
                } else {
                    logger.error(`  ❌ ${res.conditionId.substring(0, 20)}... - Failed: ${res.error || "Unknown error"}`);
                }
            }
        }
    }
    
    if (result.resolved === 0 && !dryRun) {
        logger.info("\nNo resolved markets found. All markets are either still active or not yet reported.");
    }
}

main().catch((error) => {
    logger.error("Fatal error", error);
    process.exit(1);
});

