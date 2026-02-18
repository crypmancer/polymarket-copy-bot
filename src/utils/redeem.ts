import { BigNumber } from "@ethersproject/bignumber";
import { hexZeroPad } from "@ethersproject/bytes";
import { Wallet } from "@ethersproject/wallet";
import { JsonRpcProvider } from "@ethersproject/providers";
import { Contract } from "@ethersproject/contracts";
import { resolve } from "path";
import { config as dotenvConfig } from "dotenv";
import { Chain, getContractConfig } from "@polymarket/clob-client";
import { logger } from "./logger";
import { getClobClient } from "../providers/clobclient";

dotenvConfig({ path: resolve(process.cwd(), ".env") });

// CTF Contract ABI - functions needed for redemption and checking resolution
const CTF_ABI = [
    {
        constant: false,
        inputs: [
            {
                name: "collateralToken",
                type: "address",
            },
            {
                name: "parentCollectionId",
                type: "bytes32",
            },
            {
                name: "conditionId",
                type: "bytes32",
            },
            {
                name: "indexSets",
                type: "uint256[]",
            },
        ],
        name: "redeemPositions",
        outputs: [],
        payable: false,
        stateMutability: "nonpayable",
        type: "function",
    },
    {
        constant: true,
        inputs: [
            {
                name: "",
                type: "bytes32",
            },
            {
                name: "",
                type: "uint256",
            },
        ],
        name: "payoutNumerators",
        outputs: [
            {
                name: "",
                type: "uint256",
            },
        ],
        payable: false,
        stateMutability: "view",
        type: "function",
    },
    {
        constant: true,
        inputs: [
            {
                name: "",
                type: "bytes32",
            },
        ],
        name: "payoutDenominator",
        outputs: [
            {
                name: "",
                type: "uint256",
            },
        ],
        payable: false,
        stateMutability: "view",
        type: "function",
    },
    {
        constant: true,
        inputs: [
            {
                name: "conditionId",
                type: "bytes32",
            },
        ],
        name: "getOutcomeSlotCount",
        outputs: [
            {
                name: "",
                type: "uint256",
            },
        ],
        payable: false,
        stateMutability: "view",
        type: "function",
    },
    {
        constant: true,
        inputs: [
            {
                name: "owner",
                type: "address",
            },
            {
                name: "id",
                type: "uint256",
            },
        ],
        name: "balanceOf",
        outputs: [
            {
                name: "",
                type: "uint256",
            },
        ],
        payable: false,
        stateMutability: "view",
        type: "function",
    },
    {
        constant: true,
        inputs: [
            {
                name: "parentCollectionId",
                type: "bytes32",
            },
            {
                name: "conditionId",
                type: "bytes32",
            },
            {
                name: "indexSet",
                type: "uint256",
            },
        ],
        name: "getCollectionId",
        outputs: [
            {
                name: "",
                type: "bytes32",
            },
        ],
        payable: false,
        stateMutability: "view",
        type: "function",
    },
    {
        constant: true,
        inputs: [
            {
                name: "collateralToken",
                type: "address",
            },
            {
                name: "collectionId",
                type: "bytes32",
            },
        ],
        name: "getPositionId",
        outputs: [
            {
                name: "",
                type: "uint256",
            },
        ],
        payable: false,
        stateMutability: "pure",
        type: "function",
    },
];

/**
 * Get RPC provider URL based on chain ID
 */
function getRpcUrl(chainId: number): string {
    const rpcToken = process.env.RPC_TOKEN;
    
    if (chainId === 137) {
        // Polygon Mainnet
        if (rpcToken) {
            return `https://polygon-mainnet.g.alchemy.com/v2/${rpcToken}`;
        }
        return "https://polygon-rpc.com";
    } else if (chainId === 80002) {
        // Polygon Amoy Testnet
        if (rpcToken) {
            return `https://polygon-amoy.g.alchemy.com/v2/${rpcToken}`;
        }
        return "https://rpc-amoy.polygon.technology";
    }
    
    throw new Error(`Unsupported chain ID: ${chainId}. Supported: 137 (Polygon), 80002 (Amoy)`);
}

/**
 * Options for redeeming positions
 */
export interface RedeemOptions {
    /** The condition ID (market ID) to redeem from */
    conditionId: string;
    /** Array of index sets to redeem (default: [1, 2] for Polymarket binary markets) */
    indexSets?: number[];
    /** Optional: Chain ID (defaults to Chain.POLYGON) */
    chainId?: Chain;
}

/**
 * Redeem conditional tokens for collateral after a market resolves
 * 
 * This function calls the redeemPositions function on the Conditional Tokens Framework (CTF) contract
 * to redeem winning outcome tokens for their underlying collateral (USDC).
 * 
 * For Polymarket binary markets, indexSets should be [1, 2] to redeem both YES and NO outcomes.
 * 
 * @param options - Redeem options including conditionId and optional indexSets
 * @returns Transaction receipt
 * 
 * @example
 * ```typescript
 * // Redeem a resolved market (conditionId) for both outcomes [1, 2]
 * const receipt = await redeemPositions({
 *   conditionId: "0x5f65177b394277fd294cd75650044e32ba009a95022d88a0c1d565897d72f8f1",
 *   indexSets: [1, 2], // Both YES and NO outcomes (default)
 * });
 * ```
 */
export async function redeemPositions(options: RedeemOptions): Promise<any> {
    const privateKey = process.env.PRIVATE_KEY;
    if (!privateKey) {
        throw new Error("PRIVATE_KEY not found in environment");
    }

    const chainId = options.chainId || parseInt(`${process.env.CHAIN_ID || Chain.POLYGON}`) as Chain;
    const contractConfig = getContractConfig(chainId);
    
    // Get RPC URL and create provider
    const rpcUrl = getRpcUrl(chainId);
    const provider = new JsonRpcProvider(rpcUrl);
    const wallet = new Wallet(privateKey, provider);
    
    const address = await wallet.getAddress();
    
    // Default index sets for Polymarket binary markets: [1, 2] (YES and NO)
    const indexSets = options.indexSets || [1, 2];
    
    // Parent collection ID is always bytes32(0) for Polymarket
    const parentCollectionId = "0x0000000000000000000000000000000000000000000000000000000000000000";
    
    // Convert conditionId to bytes32 format
    let conditionIdBytes32: string;
    if (options.conditionId.startsWith("0x")) {
        // Already a hex string, ensure it's exactly 32 bytes (66 chars with 0x prefix)
        conditionIdBytes32 = hexZeroPad(options.conditionId, 32);
    } else {
        // If it's a decimal string, convert to hex and pad to 32 bytes
        const bn = BigNumber.from(options.conditionId);
        conditionIdBytes32 = hexZeroPad(bn.toHexString(), 32);
    }

    // Create CTF contract instance
    const ctfContract = new Contract(
        contractConfig.conditionalTokens,
        CTF_ABI,
        wallet
    );

    logger.info("\n=== REDEEMING POSITIONS ===");
    logger.info(`Condition ID: ${conditionIdBytes32}`);
    logger.info(`Index Sets: ${indexSets.join(", ")}`);
    logger.info(`Collateral Token: ${contractConfig.collateral}`);
    logger.info(`Parent Collection ID: ${parentCollectionId}`);
    logger.info(`Wallet: ${address}`);

    // Configure gas options
    let gasOptions: { gasPrice?: BigNumber; gasLimit?: number } = {};
    try {
        const gasPrice = await provider.getGasPrice();
        gasOptions = {
            gasPrice: gasPrice.mul(120).div(100), // 20% buffer
            gasLimit: 500_000,
        };
    } catch (error) {
        gasOptions = {
            gasPrice: BigNumber.from("100000000000"), // 100 gwei
            gasLimit: 500_000,
        };
    }

    try {
        // Call redeemPositions
        logger.info("Calling redeemPositions on CTF contract...");
        const tx = await ctfContract.redeemPositions(
            contractConfig.collateral,
            parentCollectionId,
            conditionIdBytes32,
            indexSets,
            gasOptions
        );

        logger.info(`Transaction sent: ${tx.hash}`);
        logger.info("Waiting for confirmation...");

        // Wait for transaction to be mined
        const receipt = await tx.wait();
        
        logger.success(`Transaction confirmed in block ${receipt.blockNumber}`);
        logger.info(`Gas used: ${receipt.gasUsed.toString()}`);
        logger.success("\n=== REDEEM COMPLETE ===");

        return receipt;
    } catch (error: any) {
        logger.error("Failed to redeem positions", error);
        if (error.reason) {
            logger.error("Reason", error.reason);
        }
        if (error.data) {
            logger.error("Data", error.data);
        }
        throw error;
    }
}

/**
 * Retry a function with exponential backoff
 * 
 * @param fn - Function to retry
 * @param maxRetries - Maximum number of retries (default: 3)
 * @param delayMs - Initial delay in milliseconds (default: 1000)
 * @returns Result of the function
 */
async function retryWithBackoff<T>(
    fn: () => Promise<T>,
    maxRetries: number = 3,
    delayMs: number = 1000
): Promise<T> {
    let lastError: Error | unknown;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;
            const errorMsg = error instanceof Error ? error.message : String(error);
            
            // Check if error is retryable (RPC errors, network errors, etc.)
            const isRetryable = 
                errorMsg.includes("network") ||
                errorMsg.includes("timeout") ||
                errorMsg.includes("ECONNREFUSED") ||
                errorMsg.includes("ETIMEDOUT") ||
                errorMsg.includes("RPC") ||
                errorMsg.includes("rate limit") ||
                errorMsg.includes("nonce") ||
                errorMsg.includes("replacement transaction") ||
                errorMsg.includes("already known") ||
                errorMsg.includes("503") ||
                errorMsg.includes("502") ||
                errorMsg.includes("504") ||
                errorMsg.includes("connection") ||
                errorMsg.includes("socket") ||
                errorMsg.includes("ECONNRESET");
            
            // Don't retry on permanent errors
            if (!isRetryable) {
                throw error;
            }
            
            // If this is the last attempt, throw the error
            if (attempt === maxRetries) {
                throw error;
            }
            
            // Calculate delay with exponential backoff
            const delay = delayMs * Math.pow(2, attempt - 1);
            logger.warning(`Attempt ${attempt}/${maxRetries} failed: ${errorMsg}. Retrying in ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
    
    throw lastError;
}

/**
 * Redeem positions for a specific condition with manually specified index sets
 * 
 * NOTE: For automatic redemption of winning outcomes only, use redeemMarket() instead.
 * This function allows you to manually specify which indexSets to redeem.
 * 
 * @param conditionId - The condition ID (market ID) to redeem from
 * @param indexSets - Array of indexSets to redeem (e.g., [1, 2] for both outcomes)
 * @param chainId - Optional chain ID (defaults to Chain.POLYGON)
 * @returns Transaction receipt
 */
export async function redeemPositionsDefault(
    conditionId: string,
    chainId?: Chain,
    indexSets: number[] = [1, 2] // Default to both outcomes for Polymarket binary markets
): Promise<any> {
    return redeemPositions({
        conditionId,
        indexSets,
        chainId,
    });
}

/**
 * Redeem winning positions for a specific market (conditionId)
 * This function automatically determines which outcomes won and only redeems those
 * that the user actually holds tokens for.
 * 
 * Includes retry logic for RPC/network errors (3 attempts by default).
 * 
 * @param conditionId - The condition ID (market ID) to redeem from
 * @param chainId - Optional chain ID (defaults to Chain.POLYGON)
 * @param maxRetries - Maximum retry attempts for RPC/network errors (default: 3)
 * @returns Transaction receipt
 */
export async function redeemMarket(
    conditionId: string,
    chainId?: Chain,
    maxRetries: number = 3
): Promise<any> {
    const privateKey = process.env.PRIVATE_KEY;
    if (!privateKey) {
        throw new Error("PRIVATE_KEY not found in environment");
    }

    const chainIdValue = chainId || parseInt(`${process.env.CHAIN_ID || Chain.POLYGON}`) as Chain;
    const contractConfig = getContractConfig(chainIdValue);
    
    // Get RPC URL and create provider
    const rpcUrl = getRpcUrl(chainIdValue);
    const provider = new JsonRpcProvider(rpcUrl);
    const wallet = new Wallet(privateKey, provider);
    const walletAddress = await wallet.getAddress();
    
    logger.info("\n=== CHECKING MARKET RESOLUTION ===");
    
    // Check if condition is resolved and get winning outcomes
    const resolution = await checkConditionResolution(conditionId, chainIdValue);
    
    if (!resolution.isResolved) {
        throw new Error(`Market is not yet resolved. ${resolution.reason}`);
    }
    
    if (resolution.winningIndexSets.length === 0) {
        throw new Error("Condition is resolved but no winning outcomes found");
    }
    
    logger.info(`Winning indexSets: ${resolution.winningIndexSets.join(", ")}`);
    
    // Get user's token balances for this condition
    logger.info("Checking your token balances...");
    const userBalances = await getUserTokenBalances(conditionId, walletAddress, chainIdValue);
    
    if (userBalances.size === 0) {
        throw new Error("You don't have any tokens for this condition to redeem");
    }
    
    // Filter to only winning indexSets that user actually holds
    const redeemableIndexSets = resolution.winningIndexSets.filter(indexSet => {
        const balance = userBalances.get(indexSet);
        return balance && !balance.isZero();
    });
    
    if (redeemableIndexSets.length === 0) {
        const heldIndexSets = Array.from(userBalances.keys());
        throw new Error(
            `You don't hold any winning tokens. ` +
            `You hold: ${heldIndexSets.join(", ")}, ` +
            `Winners: ${resolution.winningIndexSets.join(", ")}`
        );
    }
    
    // Log what will be redeemed
    logger.info(`\nYou hold winning tokens for indexSets: ${redeemableIndexSets.join(", ")}`);
    for (const indexSet of redeemableIndexSets) {
        const balance = userBalances.get(indexSet);
        logger.info(`  IndexSet ${indexSet}: ${balance?.toString() || "0"} tokens`);
    }
    
    // Redeem only the winning outcomes user holds
    logger.info(`\nRedeeming winning positions: ${redeemableIndexSets.join(", ")}`);
    
    // Use retry logic for redemption (handles RPC/network errors)
    return retryWithBackoff(
        async () => {
            return await redeemPositions({
                conditionId,
                indexSets: redeemableIndexSets,
                chainId: chainIdValue,
            });
        },
        maxRetries,
        2000 // 2 second initial delay, then 4s, 8s
    );
}

/**
 * Check condition resolution status using CTF contract
 * 
 * @param conditionId - The condition ID (market ID) to check
 * @param chainId - Optional chain ID
 * @returns Object with resolution status and winning indexSets
 */
export async function checkConditionResolution(
    conditionId: string,
    chainId?: Chain
): Promise<{
    isResolved: boolean;
    winningIndexSets: number[];
    payoutDenominator: BigNumber;
    payoutNumerators: BigNumber[];
    outcomeSlotCount: number;
    reason?: string;
}> {
    const privateKey = process.env.PRIVATE_KEY;
    if (!privateKey) {
        throw new Error("PRIVATE_KEY not found in environment");
    }

    const chainIdValue = chainId || parseInt(`${process.env.CHAIN_ID || Chain.POLYGON}`) as Chain;
    const contractConfig = getContractConfig(chainIdValue);
    
    // Get RPC URL and create provider
    const rpcUrl = getRpcUrl(chainIdValue);
    const provider = new JsonRpcProvider(rpcUrl);
    const wallet = new Wallet(privateKey, provider);
    
    // Convert conditionId to bytes32 format
    let conditionIdBytes32: string;
    if (conditionId.startsWith("0x")) {
        conditionIdBytes32 = hexZeroPad(conditionId, 32);
    } else {
        const bn = BigNumber.from(conditionId);
        conditionIdBytes32 = hexZeroPad(bn.toHexString(), 32);
    }

    // Create CTF contract instance
    const ctfContract = new Contract(
        contractConfig.conditionalTokens,
        CTF_ABI,
        wallet
    );

    try {
        // Get outcome slot count (usually 2 for binary markets)
        const outcomeSlotCount = (await ctfContract.getOutcomeSlotCount(conditionIdBytes32)).toNumber();
        
        // Check payout denominator - if > 0, condition is resolved
        const payoutDenominator = await ctfContract.payoutDenominator(conditionIdBytes32);
        const isResolved = !payoutDenominator.isZero();
        
        let winningIndexSets: number[] = [];
        let payoutNumerators: BigNumber[] = [];
        
        if (isResolved) {
            // Get payout numerators for each outcome
            payoutNumerators = [];
            for (let i = 0; i < outcomeSlotCount; i++) {
                const numerator = await ctfContract.payoutNumerators(conditionIdBytes32, i);
                payoutNumerators.push(numerator);
                
                // If numerator > 0, this outcome won (indexSet is i+1, as indexSets are 1-indexed)
                if (!numerator.isZero()) {
                    winningIndexSets.push(i + 1);
                }
            }
            
            logger.info(`Condition resolved. Winning indexSets: ${winningIndexSets.join(", ")}`);
        } else {
            logger.info("Condition not yet resolved");
        }
        
        return {
            isResolved,
            winningIndexSets,
            payoutDenominator,
            payoutNumerators,
            outcomeSlotCount,
            reason: isResolved 
                ? `Condition resolved. Winning outcomes: ${winningIndexSets.join(", ")}`
                : "Condition not yet resolved",
        };
    } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        logger.error("Failed to check condition resolution", error);
        return {
            isResolved: false,
            winningIndexSets: [],
            payoutDenominator: BigNumber.from(0),
            payoutNumerators: [],
            outcomeSlotCount: 0,
            reason: `Error checking resolution: ${errorMsg}`,
        };
    }
}

/**
 * Get user's token balances for a specific condition
 * 
 * @param conditionId - The condition ID (market ID)
 * @param walletAddress - User's wallet address
 * @param chainId - Optional chain ID
 * @returns Map of indexSet -> token balance
 */
export async function getUserTokenBalances(
    conditionId: string,
    walletAddress: string,
    chainId?: Chain
): Promise<Map<number, BigNumber>> {
    const privateKey = process.env.PRIVATE_KEY;
    if (!privateKey) {
        throw new Error("PRIVATE_KEY not found in environment");
    }

    const chainIdValue = chainId || parseInt(`${process.env.CHAIN_ID || Chain.POLYGON}`) as Chain;
    const contractConfig = getContractConfig(chainIdValue);
    
    // Get RPC URL and create provider
    const rpcUrl = getRpcUrl(chainIdValue);
    const provider = new JsonRpcProvider(rpcUrl);
    const wallet = new Wallet(privateKey, provider);
    
    // Convert conditionId to bytes32 format
    let conditionIdBytes32: string;
    if (conditionId.startsWith("0x")) {
        conditionIdBytes32 = hexZeroPad(conditionId, 32);
    } else {
        const bn = BigNumber.from(conditionId);
        conditionIdBytes32 = hexZeroPad(bn.toHexString(), 32);
    }

    // Create CTF contract instance
    const ctfContract = new Contract(
        contractConfig.conditionalTokens,
        CTF_ABI,
        wallet
    );

    const balances = new Map<number, BigNumber>();
    const parentCollectionId = "0x0000000000000000000000000000000000000000000000000000000000000000";
    
    try {
        // Get outcome slot count
        const outcomeSlotCount = (await ctfContract.getOutcomeSlotCount(conditionIdBytes32)).toNumber();
        
        // Check balance for each indexSet (1-indexed)
        for (let i = 1; i <= outcomeSlotCount; i++) {
            try {
                // Get collection ID for this indexSet
                const collectionId = await ctfContract.getCollectionId(
                    parentCollectionId,
                    conditionIdBytes32,
                    i
                );
                
                // Get position ID (token ID)
                const positionId = await ctfContract.getPositionId(
                    contractConfig.collateral,
                    collectionId
                );
                
                // Get balance
                const balance = await ctfContract.balanceOf(walletAddress, positionId);
                if (!balance.isZero()) {
                    balances.set(i, balance);
                }
            } catch (error) {
                // Skip if error (might not have tokens for this outcome)
                continue;
            }
        }
    } catch (error) {
        logger.error("Failed to get user token balances", error);
    }
    
    return balances;
}

/**
 * Check if a market is resolved and ready for redemption
 * 
 * @param conditionId - The condition ID (market ID) to check
 * @returns Object with isResolved flag and market info
 */
export async function isMarketResolved(conditionId: string): Promise<{
    isResolved: boolean;
    market?: any;
    reason?: string;
    winningIndexSets?: number[];
}> {
    try {
        // First check CTF contract for resolution status
        const resolution = await checkConditionResolution(conditionId);
        
        if (resolution.isResolved) {
            // Also get market info from API for context
            try {
                const clobClient = await getClobClient();
                const market = await clobClient.getMarket(conditionId);
                return {
                    isResolved: true,
                    market,
                    winningIndexSets: resolution.winningIndexSets,
                    reason: `Market resolved. Winning outcomes: ${resolution.winningIndexSets.join(", ")}`,
                };
            } catch (apiError) {
                // If API fails, still return resolution status from contract
                return {
                    isResolved: true,
                    winningIndexSets: resolution.winningIndexSets,
                    reason: `Market resolved (checked via CTF contract). Winning outcomes: ${resolution.winningIndexSets.join(", ")}`,
                };
            }
        } else {
            // Check API for market status
            try {
                const clobClient = await getClobClient();
                const market = await clobClient.getMarket(conditionId);
                
                if (!market) {
                    return {
                        isResolved: false,
                        reason: "Market not found",
                    };
                }

                const isActive = market.active !== false;
                const hasOutcome = market.resolved !== false && market.outcome !== null && market.outcome !== undefined;
                
                return {
                    isResolved: false,
                    market,
                    reason: isActive 
                        ? "Market still active"
                        : "Market ended but outcome not reported yet",
                };
            } catch (apiError) {
                return {
                    isResolved: false,
                    reason: resolution.reason || "Market not resolved",
                };
            }
        }
    } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        logger.error("Failed to check market status", error);
        return {
            isResolved: false,
            reason: `Error checking market: ${errorMsg}`,
        };
    }
}

/**
 * Automatically redeem all resolved markets from holdings
 * 
 * This function:
 * 1. Gets all markets from holdings
 * 2. Checks if each market is resolved
 * 3. Redeems resolved markets with retry logic (3 attempts for RPC/network errors)
 * 4. Optionally clears holdings after successful redemption
 * 
 * @param options - Options for auto-redemption
 * @returns Summary of redemption results
 */
export async function autoRedeemResolvedMarkets(options?: {
    clearHoldingsAfterRedeem?: boolean;
    dryRun?: boolean;
    maxRetries?: number; // Max retries per redemption (default: 3)
}): Promise<{
    total: number;
    resolved: number;
    redeemed: number;
    failed: number;
    results: Array<{
        conditionId: string;
        isResolved: boolean;
        redeemed: boolean;
        error?: string;
    }>;
}> {
    const { getAllHoldings } = await import("./holdings");
    const holdings = getAllHoldings();
    
    const marketIds = Object.keys(holdings);
    const results: Array<{
        conditionId: string;
        isResolved: boolean;
        redeemed: boolean;
        error?: string;
    }> = [];
    
    let resolvedCount = 0;
    let redeemedCount = 0;
    let failedCount = 0;
    
    logger.info(`\n=== AUTO-REDEEM: Checking ${marketIds.length} markets ===`);
    
    for (const conditionId of marketIds) {
        try {
            // Check if market is resolved
            const { isResolved, reason } = await isMarketResolved(conditionId);
            
            if (isResolved) {
                resolvedCount++;
                
                if (options?.dryRun) {
                    logger.info(`[DRY RUN] Would redeem: ${conditionId}`);
                    results.push({
                        conditionId,
                        isResolved: true,
                        redeemed: false,
                    });
                } else {
                    const maxRetries = options?.maxRetries || 3;
                    
                    try {
                        // Redeem the market with retry logic
                        logger.info(`\nRedeeming resolved market: ${conditionId}`);
                        
                        await retryWithBackoff(
                            async () => {
                                await redeemMarket(conditionId);
                            },
                            maxRetries,
                            2000 // 2 second initial delay, then 4s, 8s
                        );
                        
                        redeemedCount++;
                        logger.success(`✅ Successfully redeemed ${conditionId}`);
                        
                        // Automatically clear holdings after successful redemption
                        // (tokens have been redeemed, so they're no longer in holdings)
                        try {
                            const { clearMarketHoldings } = await import("./holdings");
                            clearMarketHoldings(conditionId);
                            logger.info(`Cleared holdings record for ${conditionId} from token-holding.json`);
                        } catch (clearError) {
                            logger.warning(`Failed to clear holdings for ${conditionId}: ${clearError instanceof Error ? clearError.message : String(clearError)}`);
                            // Don't fail the redemption if clearing holdings fails
                        }
                        
                        results.push({
                            conditionId,
                            isResolved: true,
                            redeemed: true,
                        });
                    } catch (error) {
                        failedCount++;
                        const errorMsg = error instanceof Error ? error.message : String(error);
                        logger.error(`Failed to redeem ${conditionId} after ${maxRetries} attempts`, error);
                        results.push({
                            conditionId,
                            isResolved: true,
                            redeemed: false,
                            error: errorMsg,
                        });
                    }
                }
            } else {
                logger.info(`Market ${conditionId} not resolved: ${reason}`);
                results.push({
                    conditionId,
                    isResolved: false,
                    redeemed: false,
                    error: reason,
                });
            }
        } catch (error) {
            failedCount++;
            const errorMsg = error instanceof Error ? error.message : String(error);
            logger.error(`Error processing ${conditionId}`, error);
            results.push({
                conditionId,
                isResolved: false,
                redeemed: false,
                error: errorMsg,
            });
        }
    }
    
    logger.info(`\n=== AUTO-REDEEM SUMMARY ===`);
    logger.info(`Total markets: ${marketIds.length}`);
    logger.info(`Resolved: ${resolvedCount}`);
    logger.info(`Redeemed: ${redeemedCount}`);
    logger.info(`Failed: ${failedCount}`);
    
    return {
        total: marketIds.length,
        resolved: resolvedCount,
        redeemed: redeemedCount,
        failed: failedCount,
        results,
    };
}

/**
 * Interface for current position from Polymarket data API
 */
export interface CurrentPosition {
    proxyWallet: string;
    asset: string;
    conditionId: string;
    size: number;
    avgPrice: number;
    initialValue: number;
    currentValue: number;
    cashPnl: number;
    percentPnl: number;
    totalBought: number;
    realizedPnl: number;
    percentRealizedPnl: number;
    curPrice: number;
    redeemable: boolean;
    mergeable: boolean;
    title: string;
    slug: string;
    icon: string;
    eventSlug: string;
    outcome: string;
    outcomeIndex: number;
    oppositeOutcome: string;
    oppositeAsset: string;
    endDate: string;
    negativeRisk: boolean;
}

/**
 * Get all markets where user has CURRENT/ACTIVE positions using Polymarket data API
 * 
 * This uses the /positions endpoint which returns your CURRENT positions (tokens you currently hold).
 * This is the correct endpoint for redemption - you can only redeem tokens you currently have!
 * 
 * @param options - Options for fetching
 * @returns Array of markets where user has active positions
 */
export async function getMarketsWithUserPositions(
    options?: {
        maxPositions?: number; // Max positions to fetch (default: 1000)
        walletAddress?: string;
        chainId?: Chain;
        onlyRedeemable?: boolean; // Only return positions that are redeemable (default: false)
    }
): Promise<Array<{ conditionId: string; position: CurrentPosition; balances: Map<number, BigNumber> }>> {
    const privateKey = process.env.PRIVATE_KEY;
    if (!privateKey) {
        throw new Error("PRIVATE_KEY not found in environment");
    }

    const chainIdValue = options?.chainId || parseInt(`${process.env.CHAIN_ID || Chain.POLYGON}`) as Chain;
    
    // Get RPC URL and create provider
    const rpcUrl = getRpcUrl(chainIdValue);
    const provider = new JsonRpcProvider(rpcUrl);
    const wallet = new Wallet(privateKey, provider);
    const walletAddress = options?.walletAddress || await wallet.getAddress();
    
    logger.info(`\n=== FINDING YOUR CURRENT/ACTIVE POSITIONS ===`);
    logger.info(`Wallet: ${walletAddress}`);
    logger.info(`Using /positions endpoint (returns tokens you currently hold)`);
    
    const marketsWithPositions: Array<{ conditionId: string; position: CurrentPosition; balances: Map<number, BigNumber> }> = [];
    
    try {
        // Use Polymarket data-api /positions endpoint (CORRECT METHOD for active positions!)
        const dataApiUrl = "https://data-api.polymarket.com";
        const endpoint = "/positions";
        let allPositions: CurrentPosition[] = [];
        let offset = 0;
        const limit = 500; // Max per request
        const maxPositions = options?.maxPositions || 1000;
        
        // Fetch all current positions with pagination
        while (allPositions.length < maxPositions) {
            const params = new URLSearchParams({
                user: walletAddress,
                limit: limit.toString(),
                offset: offset.toString(),
                sortBy: "TOKENS",
                sortDirection: "DESC",
                sizeThreshold: "0", // Get all positions, even small ones
            });
            
            if (options?.onlyRedeemable) {
                params.append("redeemable", "true");
            }
            
            const url = `${dataApiUrl}${endpoint}?${params.toString()}`;
            
            try {
                const response = await fetch(url);
                
                if (!response.ok) {
                    throw new Error(`Failed to fetch positions: ${response.status} ${response.statusText}`);
                }
                
                const positions = await response.json() as CurrentPosition[];
                
                if (!Array.isArray(positions) || positions.length === 0) {
                    break; // No more positions
                }
                
                allPositions = [...allPositions, ...positions];
                logger.info(`Fetched ${allPositions.length} current position(s)...`);
                
                // If we got fewer results than the limit, we've reached the end
                if (positions.length < limit) {
                    break;
                }
                
                offset += limit;
            } catch (error) {
                logger.error("Error fetching positions", error);
                break;
            }
        }
        
        logger.info(`\n✅ Found ${allPositions.length} current position(s) from API`);
        
        // Group positions by conditionId and verify on-chain balances
        const positionsByMarket = new Map<string, CurrentPosition[]>();
        for (const position of allPositions) {
            if (position.conditionId) {
                if (!positionsByMarket.has(position.conditionId)) {
                    positionsByMarket.set(position.conditionId, []);
                }
                positionsByMarket.get(position.conditionId)!.push(position);
            }
        }
        
        logger.info(`Found ${positionsByMarket.size} unique market(s) with current positions`);
        logger.info(`\nVerifying on-chain balances...`);
        
        // For each market, verify on-chain balances
        for (const [conditionId, positions] of positionsByMarket.entries()) {
            try {
                // Verify user currently has tokens in this market (on-chain check)
                const userBalances = await getUserTokenBalances(conditionId, walletAddress, chainIdValue);
                
                if (userBalances.size > 0) {
                    // User has active positions in this market!
                    // Use the first position as representative (they all have same conditionId)
                    marketsWithPositions.push({ 
                        conditionId, 
                        position: positions[0], 
                        balances: userBalances 
                    });
                    
                    if (marketsWithPositions.length % 10 === 0) {
                        logger.info(`Verified ${marketsWithPositions.length} market(s) with active positions...`);
                    }
                } else {
                    // API says we have positions, but on-chain check shows 0
                    // This shouldn't happen, but log it
                    logger.warning(`API shows positions for ${conditionId}, but on-chain balance is 0`);
                }
            } catch (error) {
                // Skip if error checking balances
                continue;
            }
        }
        
        logger.info(`\n✅ Found ${marketsWithPositions.length} market(s) where you have ACTIVE positions`);
        
        // Show redeemable positions if any
        const redeemableCount = allPositions.filter(p => p.redeemable).length;
        if (redeemableCount > 0) {
            logger.info(`📋 ${redeemableCount} position(s) are marked as redeemable by API`);
        }
        
    } catch (error) {
        logger.error("Failed to find markets with active positions", error);
        throw error;
    }
    
    return marketsWithPositions;
}

/**
 * Get only redeemable positions (positions that can be redeemed)
 * Uses the /positions endpoint with redeemable=true filter
 * 
 * @param options - Options for fetching
 * @returns Array of redeemable positions
 */
export async function getRedeemablePositions(
    options?: {
        maxPositions?: number;
        walletAddress?: string;
        chainId?: Chain;
    }
): Promise<Array<{ conditionId: string; position: CurrentPosition; balances: Map<number, BigNumber> }>> {
    return getMarketsWithUserPositions({
        ...options,
        onlyRedeemable: true,
    });
}

/**
 * Fetch all markets from Polymarket API, find ones where user has positions,
 * and redeem all winning positions
 * This function doesn't rely on token-holding.json - it discovers positions via API + on-chain checks
 * 
 * @param options - Options for auto-redemption
 * @returns Summary of redemption results
 */
export async function redeemAllWinningMarketsFromAPI(options?: {
    maxMarkets?: number; // Limit number of markets to check (default: 1000)
    dryRun?: boolean;
}): Promise<{
    totalMarketsChecked: number;
    marketsWithPositions: number;
    resolved: number;
    withWinningTokens: number;
    redeemed: number;
    failed: number;
    results: Array<{
        conditionId: string;
        marketTitle?: string;
        isResolved: boolean;
        hasWinningTokens: boolean;
        redeemed: boolean;
        winningIndexSets?: number[];
        error?: string;
    }>;
}> {
    const privateKey = process.env.PRIVATE_KEY;
    if (!privateKey) {
        throw new Error("PRIVATE_KEY not found in environment");
    }

    const chainIdValue = parseInt(`${process.env.CHAIN_ID || Chain.POLYGON}`) as Chain;
    const contractConfig = getContractConfig(chainIdValue);
    
    // Get RPC URL and create provider
    const rpcUrl = getRpcUrl(chainIdValue);
    const provider = new JsonRpcProvider(rpcUrl);
    const wallet = new Wallet(privateKey, provider);
    const walletAddress = await wallet.getAddress();
    
    const clobClient = await getClobClient();
    
    const maxMarkets = options?.maxMarkets || 1000;
    
    logger.info(`\n=== FETCHING YOUR POSITIONS FROM POLYMARKET API ===`);
    logger.info(`Wallet: ${walletAddress}`);
    logger.info(`Max markets to check: ${maxMarkets}`);
    logger.info(`\nStep 1: Finding markets where you have positions...`);
    
    const results: Array<{
        conditionId: string;
        marketTitle?: string;
        isResolved: boolean;
        hasWinningTokens: boolean;
        redeemed: boolean;
        winningIndexSets?: number[];
        error?: string;
    }> = [];
    
    let totalMarketsChecked = 0;
    let marketsWithPositions = 0;
    let resolvedCount = 0;
    let withWinningTokensCount = 0;
    let redeemedCount = 0;
    let failedCount = 0;
    
    // Step 1: Find all markets where user has positions
    logger.info(`\nStep 1: Finding markets where you have positions...`);
    const marketsWithUserPositionsData = await getMarketsWithUserPositions({
        maxPositions: maxMarkets,
        walletAddress,
        chainId: chainIdValue,
    });
    
    marketsWithPositions = marketsWithUserPositionsData.length;
    totalMarketsChecked = marketsWithPositions; // Approximate, actual count is in the function
    
    logger.info(`\nStep 2: Checking which markets are resolved and if you won...\n`);
    
    try {
        
        // Step 2: For each market where user has positions, check resolution and redeem winners
        for (const { conditionId, position, balances: cachedBalances } of marketsWithUserPositionsData) {
            try {
                // Check if market is resolved
                const resolution = await checkConditionResolution(conditionId, chainIdValue);
                
                if (!resolution.isResolved) {
                    // Not resolved yet
                    results.push({
                        conditionId,
                        marketTitle: position?.title || conditionId,
                        isResolved: false,
                        hasWinningTokens: false,
                        redeemed: false,
                    });
                    continue;
                }
                
                resolvedCount++;
                
                // Use cached balances from Step 1 (no need to query again)
                const userBalances = cachedBalances;
                
                // Filter to only winning indexSets that user holds
                const winningHeld = resolution.winningIndexSets.filter(indexSet => {
                    const balance = userBalances.get(indexSet);
                    return balance && !balance.isZero();
                });
                
                if (winningHeld.length > 0) {
                    withWinningTokensCount++;
                    
                    const marketTitle = position?.title || conditionId;
                    logger.info(`\n✅ Found winning market: ${marketTitle}`);
                    logger.info(`   Condition ID: ${conditionId}`);
                    logger.info(`   Winning indexSets: ${resolution.winningIndexSets.join(", ")}`);
                    logger.info(`   Your winning tokens: ${winningHeld.join(", ")}`);
                    if (position?.redeemable) {
                        logger.info(`   API marks this as redeemable: ✅`);
                    }
                    
                    if (options?.dryRun) {
                        logger.info(`[DRY RUN] Would redeem: ${conditionId}`);
                        results.push({
                            conditionId,
                            marketTitle,
                            isResolved: true,
                            hasWinningTokens: true,
                            redeemed: false,
                            winningIndexSets: resolution.winningIndexSets,
                        });
                    } else {
                        try {
                            // Redeem winning positions
                            logger.info(`Redeeming winning positions...`);
                            await redeemPositions({
                                conditionId,
                                indexSets: winningHeld,
                                chainId: chainIdValue,
                            });
                            
                            redeemedCount++;
                            logger.success(`✅ Successfully redeemed ${conditionId}`);
                            
                            // Automatically clear holdings after successful redemption
                            try {
                                const { clearMarketHoldings } = await import("./holdings");
                                clearMarketHoldings(conditionId);
                                logger.info(`Cleared holdings record for ${conditionId} from token-holding.json`);
                            } catch (clearError) {
                                logger.warning(`Failed to clear holdings for ${conditionId}: ${clearError instanceof Error ? clearError.message : String(clearError)}`);
                                // Don't fail the redemption if clearing holdings fails
                            }
                            
                            results.push({
                                conditionId,
                                marketTitle,
                                isResolved: true,
                                hasWinningTokens: true,
                                redeemed: true,
                                winningIndexSets: resolution.winningIndexSets,
                            });
                        } catch (error) {
                            failedCount++;
                            const errorMsg = error instanceof Error ? error.message : String(error);
                            logger.error(`Failed to redeem ${conditionId}`, error);
                            results.push({
                                conditionId,
                                marketTitle,
                                isResolved: true,
                                hasWinningTokens: true,
                                redeemed: false,
                                winningIndexSets: resolution.winningIndexSets,
                                error: errorMsg,
                            });
                        }
                    }
                } else {
                    // Resolved but user doesn't have winning tokens (they lost)
                    results.push({
                        conditionId,
                        marketTitle: position?.title || conditionId,
                        isResolved: true,
                        hasWinningTokens: false,
                        redeemed: false,
                        winningIndexSets: resolution.winningIndexSets,
                    });
                }
            } catch (error) {
                failedCount++;
                const errorMsg = error instanceof Error ? error.message : String(error);
                logger.error(`Error processing market ${conditionId}`, error);
                results.push({
                    conditionId,
                    marketTitle: position?.title || conditionId,
                    isResolved: false,
                    hasWinningTokens: false,
                    redeemed: false,
                    error: errorMsg,
                });
            }
        }
        
        logger.info(`\n=== API REDEMPTION SUMMARY ===`);
        logger.info(`Total markets checked: ${totalMarketsChecked}`);
        logger.info(`Markets where you have positions: ${marketsWithPositions}`);
        logger.info(`Resolved markets: ${resolvedCount}`);
        logger.info(`Markets with winning tokens: ${withWinningTokensCount}`);
        if (options?.dryRun) {
            logger.info(`Would redeem: ${withWinningTokensCount} market(s)`);
        } else {
            logger.success(`Successfully redeemed: ${redeemedCount} market(s)`);
            if (failedCount > 0) {
                logger.warning(`Failed: ${failedCount} market(s)`);
            }
        }
        
        return {
            totalMarketsChecked,
            marketsWithPositions,
            resolved: resolvedCount,
            withWinningTokens: withWinningTokensCount,
            redeemed: redeemedCount,
            failed: failedCount,
            results,
        };
    } catch (error) {
        logger.error("Failed to fetch and redeem markets from API", error);
        throw error;
    }
}

