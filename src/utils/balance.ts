import { ClobClient, AssetType, type OpenOrder } from "@polymarket/clob-client";
import { logger } from "./logger";

/**
 * Calculate available balance for placing orders
 * Formula: availableBalance = totalBalance - sum of (orderSize - orderFillAmount) for open orders
 */
export async function getAvailableBalance(
    client: ClobClient,
    assetType: AssetType,
    tokenId?: string
): Promise<number> {
    try {
        // Get total balance
        const balanceResponse = await client.getBalanceAllowance({
            asset_type: assetType,
            ...(tokenId && { token_id: tokenId }),
        });

        const totalBalance = parseFloat(balanceResponse.balance || "0");

        // Get open orders for this asset
        const openOrders = await client.getOpenOrders(
            tokenId ? { asset_id: tokenId } : undefined
        );

        // Calculate reserved amount from open orders
        let reservedAmount = 0;
        for (const order of openOrders) {
            // Only count orders for the same asset type
            const orderSide = order.side.toUpperCase();
            const isBuyOrder = orderSide === "BUY";
            const isSellOrder = orderSide === "SELL";

            // For BUY orders, reserve USDC (COLLATERAL)
            // For SELL orders, reserve tokens (CONDITIONAL)
            if (
                (assetType === AssetType.COLLATERAL && isBuyOrder) ||
                (assetType === AssetType.CONDITIONAL && isSellOrder)
            ) {
                const orderSize = parseFloat(order.original_size || "0");
                const sizeMatched = parseFloat(order.size_matched || "0");
                const reserved = orderSize - sizeMatched;
                reservedAmount += reserved;
            }
        }

        const availableBalance = totalBalance - reservedAmount;

        logger.debug(
            `Balance check: Total=${totalBalance}, Reserved=${reservedAmount}, Available=${availableBalance}`
        );

        return Math.max(0, availableBalance);
    } catch (error) {
        logger.error(
            `Failed to get available balance: ${error instanceof Error ? error.message : String(error)}`
        );
        // Return 0 on error to be safe
        return 0;
    }
}

/**
 * Get and display wallet balance details
 */
export async function displayWalletBalance(client: ClobClient): Promise<void> {
    try {
        const balanceResponse = await client.getBalanceAllowance({
            asset_type: AssetType.COLLATERAL,
        });

        const balance = parseFloat(balanceResponse.balance || "0");
        const allowance = parseFloat(balanceResponse.allowance || "0");

        logger.info("═══════════════════════════════════════");
        logger.info("💰 WALLET BALANCE & ALLOWANCE");
        logger.info("═══════════════════════════════════════");
        logger.info(`USDC Balance: ${balance.toFixed(6)}`);
        logger.info(`USDC Allowance: ${allowance.toFixed(6)}`);
        logger.info(`Available: ${balance.toFixed(6)} (Balance: ${balance.toFixed(6)}, Allowance: ${allowance.toFixed(6)})`);
        logger.info("═══════════════════════════════════════");
    } catch (error) {
        logger.error(`Failed to get wallet balance: ${error instanceof Error ? error.message : String(error)}`);
    }
}

/**
 * Validate if we have enough balance for a BUY order
 */
export async function validateBuyOrderBalance(
    client: ClobClient,
    requiredAmount: number
): Promise<{ valid: boolean; available: number; required: number; balance?: number; allowance?: number }> {
    try {
        // Get balance and allowance details
        const balanceResponse = await client.getBalanceAllowance({
            asset_type: AssetType.COLLATERAL,
        });

        const balance = parseFloat(balanceResponse.balance || "0");
        const allowance = parseFloat(balanceResponse.allowance || "0");
        const available = await getAvailableBalance(client, AssetType.COLLATERAL);
        const valid = available >= requiredAmount;

        if (!valid) {
            logger.warning("═══════════════════════════════════════");
            logger.warning("⚠️  INSUFFICIENT BALANCE/ALLOWANCE");
            logger.warning("═══════════════════════════════════════");
            logger.warning(`Required: ${requiredAmount.toFixed(6)} USDC`);
            logger.warning(`Available: ${available.toFixed(6)} USDC`);
            logger.warning(`Balance: ${balance.toFixed(6)} USDC`);
            logger.warning(`Allowance: ${allowance.toFixed(6)} USDC`);
            logger.warning("═══════════════════════════════════════");
        }

        return { valid, available, required: requiredAmount, balance, allowance };
    } catch (error) {
        logger.error(`Failed to validate balance: ${error instanceof Error ? error.message : String(error)}`);
        const available = await getAvailableBalance(client, AssetType.COLLATERAL);
        return { valid: false, available, required: requiredAmount };
    }
}

/**
 * Validate if we have enough tokens for a SELL order
 */
export async function validateSellOrderBalance(
    client: ClobClient,
    tokenId: string,
    requiredAmount: number
): Promise<{ valid: boolean; available: number; required: number }> {
    const available = await getAvailableBalance(client, AssetType.CONDITIONAL, tokenId);
    const valid = available >= requiredAmount;

    if (!valid) {
        logger.warning(
            `Insufficient token balance: Token=${tokenId.substring(0, 20)}..., Required=${requiredAmount}, Available=${available}`
        );
    }

    return { valid, available, required: requiredAmount };
}

