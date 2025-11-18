import readline from "readline"
import { getSolanaPrice } from "../src/get_balance";

export const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
})

export const screen_clear = () => {
    console.clear();
}

export const main_menu_display = async () => {
    await getSolanaPrice();
    console.log('\t[1] - Create Mint Address');
    console.log('\t[2] - Create Pool And BundleBuy');
    console.log('\t[3] - Sell All Tokens From All Wallets');
    console.log('\t[4] - Check All Wallets Balance');
    console.log('\t[5] - Exit');
}

