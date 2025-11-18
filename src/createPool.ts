import { Keypair, PublicKey } from "@solana/web3.js";
import base58 from "bs58";
import { connection } from "../config";
import { CreateTokenMetadata } from "../settings";
import { BundleService } from "./services/BundleService";
import { BloxRouteService } from "./services/BloxRouteService";
import { FileUtils } from "./utils/fileUtils";
import { mainMenuWaiting } from "./utils";
import { getAssociatedTokenAddress } from "@solana/spl-token";

/**
 * Main bundle pool buy function - Creates token and sends bundle transactions
 */
export const bundlePoolBuy = async (): Promise<void> => {
  try {
    // Read wallet data
    const mint = FileUtils.readMintAddrFromFile();
    const creatorPk = FileUtils.readCreatorWallet();
    if (!creatorPk) {
      throw new Error("Creator wallet not found");
    }

    const mainKp = Keypair.fromSecretKey(base58.decode(creatorPk));

    // Create bundle transactions
    const versionedTxs = await BundleService.createBundlePoolBuy(
      mint,
      mainKp,
      CreateTokenMetadata
    );

    if (versionedTxs.length === 0) {
      throw new Error("Failed to create bundle transactions");
    }

    // Send bundle via BloxRoute
    const bloxRouteService = new BloxRouteService(connection);
    await bloxRouteService.sendBundle(versionedTxs, mainKp);


    // Once its confirmed, build bundle sell from second wallet and buy same amount of tokens second wallet sold using third wallet
    const secondWallet = FileUtils.readSecondWallet();

    if (!secondWallet) {
      throw new Error("Second wallet not found");
    }

    const secondKeypair = Keypair.fromSecretKey(base58.decode(secondWallet));
    
    // wait until second wallet has balance tokens
    while (true) {
      console.log("Waiting for second wallet to have balance tokens...");
      try {
        const secondWalletAta = await getAssociatedTokenAddress(mint.publicKey, secondKeypair.publicKey);
        const secondWalletAtaBalance = await connection.getTokenAccountBalance(secondWalletAta);
        if (Number(secondWalletAtaBalance.value.amount) > 0) {
          break;
        }
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        console.error("Error in waiting for second wallet to have balance tokens:");
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    const thirdWallet = FileUtils.readThirdWallet();

    if (!thirdWallet) {
      throw new Error("Third wallet not found");
    }

    const thirdKeypair = Keypair.fromSecretKey(base58.decode(thirdWallet));
    const sellBuyTxs = await BundleService.createBundlePoolSellFromSecondWallet(
      mint,
      secondKeypair,
      thirdKeypair,
      mainKp
    );

    if (!sellBuyTxs) {
      throw new Error("Failed to create bundle sell from second wallet");
    }

    if (sellBuyTxs.length === 0) {
      throw new Error("Failed to create bundle sell from second wallet");
    }

    await bloxRouteService.sendBundle(sellBuyTxs, mainKp);

    console.log("Bundle pool buy completed successfully");
    mainMenuWaiting();
  } catch (error) {
    console.error("Error in bundlePoolBuy:", error);
    mainMenuWaiting();
  }
};

/**
 * Main bundle sell all function - Sells all tokens from all wallets
 */
export const bundlePoolSellAll = async (): Promise<void> => {
  try {
    console.log("Starting sell all tokens from all wallets...");

    // Read creator wallet to use as payer for bundle fees
    const creatorPk = FileUtils.readCreatorWallet();
    if (!creatorPk) {
      throw new Error("Creator wallet not found");
    }

    const mainKp = Keypair.fromSecretKey(base58.decode(creatorPk));
    // Create sell transaction
    const sellTx = await BundleService.sellAllTokensFromAllWallets(mainKp);

    if (!sellTx) {
      console.log("No tokens to sell or failed to create sell transaction");
      mainMenuWaiting();
      return;
    }


    // Send bundle via BloxRoute
    const bloxRouteService = new BloxRouteService(connection);
    await bloxRouteService.sendBundle([sellTx], mainKp);
    
    console.log("Bundle sell all completed successfully");
    mainMenuWaiting();
  } catch (error) {
    console.error("Error in bundlePoolSellAll:", error);
    mainMenuWaiting();
  }
};

// Export types for backward compatibility
export type { TokenMetadata as CreateTokenMetadataType } from "./types/pumpfun";
