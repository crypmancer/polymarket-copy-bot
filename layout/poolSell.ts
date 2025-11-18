import { bundlePoolSellAll } from "../src/createPool";
import { mainMenuWaiting } from "../src/legacyUtils";

/**
 * Bundle pool sell all handler
 */
export const bundle_pool_sell_all = async (): Promise<void> => {
  try {
    console.log("Selling all tokens from all wallets...");
    await bundlePoolSellAll();
  } catch (error) {
    console.error("Error in bundle pool sell all:", error);
    mainMenuWaiting();
  }
};

