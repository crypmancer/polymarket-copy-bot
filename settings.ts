import { Keypair } from '@solana/web3.js';
import bs58 from 'bs58';

// **************************************************** //
// ***************   SETTINGS   *********************** //
// **************************************************** //
// SD, You should set following values before you run the program.

// settings about token you are going to Mint
export const CreateTokenMetadata =
{
  name: 'Mayhem',
  symbol: '5HEM',
  description: "Pumpfun bundler that supports token2022(Mayhem Mode)",
  twitter: "https://x.com/hodlwarden",
  telegram: "https://t.me/hodlwarden",
  website: "https://github.com/hodlwarden/pumpfun-bundler-token2022-mayhem"
}

export const DEV_BUY_SOL_AMOUNT = 0.0001;
export const WALLET_BUY_SOL_AMOUNT = 0.0001;

// amount of baseToken to put into the pool (0.5 is 50%, 1 is 100%)
export const input_baseMint_tokens_percentage = 1 //ABC-Mint amount of tokens you want to add in Lp e.g. 1 = 100%. 0.9= 90%

// amount of Sol to put into the Pool as liquidity
export let quote_Mint_amount = 0.01; //COIN-SOL, amount of SOL u want to add to Pool amount

// amount of Sol to bundle buy with three wallets (0.01 is 0.01sol)
export const swapSolAmount = 0.0001;

// number of wallets in each transaction
// export const batchSize = 1

// number of wallets to bundle buy
export const bundleWalletNum = 1

// percent of LP tokens to burn
export const burnLpQuantityPercent = 70   // 70 is 70% of total lp token supply

// whether you distribute the sol to existing wallets or new wallets
export const needNewWallets = true
