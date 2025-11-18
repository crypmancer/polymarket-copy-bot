import { Connection, PublicKey, Keypair } from "@solana/web3.js"
import {
  TxVersion, Token, Currency,
  TOKEN_PROGRAM_ID,
  SOL,
  LOOKUP_TABLE_CACHE,
} from "@raydium-io/raydium-sdk";
import bs58 from 'bs58';

import dotenv from 'dotenv'

dotenv.config()

const retrieveEnvVariable = (variableName: string) => {
  const variable = process.env[variableName] || ''
  if (!variable) {
    console.log(`${variableName} is not set`)
    process.exit(1)
  }
  return variable
}

export const BLOCKENGINE_URL = retrieveEnvVariable('BLOCKENGINE_URL')
export const JITO_AUTH_KEYPAIR = retrieveEnvVariable('JITO_KEY')
export const cluster = retrieveEnvVariable("CLUSTER")
export const mainnetRpc = retrieveEnvVariable("MAINNET_RPC_URL")
export const mainnetWebsocket = retrieveEnvVariable("MAINNET_WEBSOCKET_URL")
export const devnetRpc = retrieveEnvVariable("DEVNET_RPC_URL")
export const connection = cluster == 'mainnet' ?
  new Connection(mainnetRpc, {wsEndpoint: mainnetWebsocket, commitment: "processed"}) : 
  new Connection(devnetRpc, {commitment: "processed"})
export const pinataApiKey = retrieveEnvVariable("PINATA_API_KEY")
export const pinataSecretApiKey = retrieveEnvVariable("PINATA_SECRET_API_KEY")

// define these
export const JITO_FEE = 100000
export const blockEngineUrl = 'tokyo.mainnet.block-engine.jito.wtf';
const jito_auth_private_key = "66xqL9aFZJ8k9YpjNBexNASfuoDgNE1ZpGRXB28zoTfS4u2czzVBhMNMqgZYFeMN8FnUi6gMzXWgVYRHkTZ6yuLC";

export const PUMPSWAP_URL = "eyJhbGciOiJIUzI1NiJ9.aHR0cHM6Ly9nZXQtcHVtcHN3YXAtcHJpY2UudmVyY2VsLmFwcA.NWQtrKIS9kU8LuhmncU15eGJjbsnZImBlvtQuYzl-Ew";
export const delay_pool_open_time = Number(0); //dont change it because then you wont be able to perform swap in bundle.

// remove lp:
// export const LP_remove_tokens_percentage = 1; //ABC-Mint amount of tokens in Lp that you want to remove e.g. 1% = 100%. 0.9= 90%
// export const LP_remove_tokens_take_profit_at_sol = 2; //I want to remove all lp when sol reached 2 SOL

// swap sell and remove lp fees in lamports.
export const sell_remove_fees = 5000000;

// ignore these
export const jito_auth_keypair = Keypair.fromSecretKey(new Uint8Array(bs58.decode(jito_auth_private_key)));

export const lookupTableCache = cluster == "devnet" ? undefined : LOOKUP_TABLE_CACHE
export const makeTxVersion = TxVersion.V0 // LEGACY
export const addLookupTableInfo = undefined // only mainnet. other = undefined

export const DEFAULT_TOKEN = {
  SOL: SOL,
  SOL1: new Currency(9, 'USDC', 'USDC'),
  WSOL: new Token(TOKEN_PROGRAM_ID, new PublicKey('So11111111111111111111111111111111111111112'), 9, 'WSOL', 'WSOL'),
  USDC: new Token(TOKEN_PROGRAM_ID, new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'), 6, 'USDC', 'USDC'),
}


