import { screen_clear } from "../menu/menu";
import { mainMenuWaiting } from "../src/legacyUtils";
import { FileUtils } from "../src/utils/fileUtils";
import { AsyncUtils } from "../src/utils/asyncUtils";
import { WalletService } from "../src/services/WalletService";
import { FEE_WALLET_KEYPAIR, needNewWallets, quote_Mint_amount } from "../settings";

/**
 * Create and fund creator wallet
 */
export const wallet_create = async (): Promise<void> => {
  screen_clear();
  console.log("Creating creator wallet");

  try {
    // Step 1: Create new wallet if needed
    if (needNewWallets) {
      try {
        WalletService.createAndSaveWallet();
        await AsyncUtils.sleep(2000);
      } catch (error) {
        console.error("Error creating wallet:", error);
      }
    }

    // Step 2: Read saved wallet
    const savedWallet = FileUtils.readCreatorWallet();
    if (!savedWallet) {
      console.error("Creator wallet does not exist!");
      mainMenuWaiting();
      return;
    }

    // Step 3: Distribute SOL to wallet
    const txSig = await WalletService.distributeSOL(
      FEE_WALLET_KEYPAIR,
      savedWallet,
      quote_Mint_amount
    );

    if (txSig) {
      console.log("Successfully created and funded creator wallet!");
    } else {
      console.error("Failed to fund creator wallet");
    }
  } catch (error) {
    console.error("Error in wallet creation:", error);
  }

  mainMenuWaiting();
};
