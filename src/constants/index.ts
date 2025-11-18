import { PublicKey } from "@solana/web3.js";

/**
 * Pump.fun Program Constants
 */
export const PUMP_FEE_RECEIVER = new PublicKey("62qc2CNXwrYqQScmEdiZFFAnJR262PxWEuNQtxfafNgV");

/**
 * BloxRoute Constants
 */
export const BLOXROUTE_SUBMIT_BATCH_URL = 'https://germany.solana.dex.blxrbdn.com/api/v2/submit-batch';
export const DEFAULT_TIP_AMOUNT_SOL = 0.001;
export const BLOXROUTE_TIP_ACCOUNTS = [
  'HWEoBxYs7ssKuudEjzjmpfJVX7Dvi7wescFsVx2L5yoY',
  '95cfoy472fcQHaw4tPGBTKpn6ZQnfEPfBgDQx6gcRmRg'
];

/**
 * Compute Budget Constants
 */
export const COMPUTE_UNIT_PRICE = 200_000; // microLamports
export const COMPUTE_UNIT_LIMIT = 600_000;

/**
 * Transaction Amounts
 */
export const DEFAULT_TOKEN_AMOUNT = 10_000_000;
export const DEFAULT_SOL_AMOUNT = 10_000_000_000_000;

/**
 * File Paths
 */
export const WALLET_PATHS = {
  MINT_ADDR: "./wallets/mintAddr.json",
  CREATOR: "wallets/creator.json",
  SECOND_WALLET: "wallets/second.json",
  LUT_ADDRESS: "wallets/lutAddress.txt",
  THIRD_WALLET: "wallets/third.json",
} as const;

/**
 * Metadata API
 */
export const METADATA_API_URL = "https://pump.fun/api/ipfs";
export const METADATA_IMAGE_PATH = "./src/images/1.jpg";

/**
 * HTTP Headers for Metadata API
 */
export const METADATA_API_HEADERS = {
  "Host": "www.pump.fun",
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:126.0) Gecko/20100101 Firefox/126.0",
  "Accept": "*/*",
  "Accept-Language": "en-US,en;q=0.5",
  "Accept-Encoding": "gzip, deflate, br, zstd",
  "Referer": "https://www.pump.fun/create",
  "Origin": "https://www.pump.fun",
  "Connection": "keep-alive",
  "Sec-Fetch-Dest": "empty",
  "Sec-Fetch-Mode": "cors",
  "Sec-Fetch-Site": "same-origin",
  "Priority": "u=1",
  "TE": "trailers"
} as const;

