import { bundlePoolBuy } from "../src/createPool";
import { mainMenuWaiting } from "../src/legacyUtils";

/**
 * Bundle pool buy handler
 */
export const bundle_pool_buy = async (): Promise<void> => {
  try {
    console.log("Creating Pool and Bundle Buy Process Started...");
    await bundlePoolBuy();
  } catch (error) {
    console.error("Error in bundle pool buy:", error);
    mainMenuWaiting();
  }
};
