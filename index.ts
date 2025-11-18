import { mainMenuWaiting, sleep } from "./src/utils"

import { main_menu_display, rl, screen_clear } from "./menu/menu";
import { bundle_pool_buy } from "./layout/poolBuy";
import { wallet_create } from "./layout/walletCreate";
import { createMintAddr } from "./layout/createMintAddr";
import { bundle_pool_sell_all } from "./layout/poolSell";
import { connection } from "./config";
import { checkAllWalletsBalance } from "./layout/checkAllWalletsBalance";

export const init = async () => {
  screen_clear();

  await main_menu_display();
 

  rl.question("\t[Main] - Choice: ", (answer: string) => {
    let choice = parseInt(answer);
    switch (choice) {
      case 1:
        createMintAddr();
        mainMenuWaiting();
        break;
      case 2:
        bundle_pool_buy();
        break;
      case 3:
        bundle_pool_sell_all();
        break;
      case 4:
        checkAllWalletsBalance();
        break;
      case 5:
        process.exit(1);
        break;
      default:
        console.log("\tInvalid choice!");
        sleep(1500);
        init();
        break;
    }
  })
}

init()
