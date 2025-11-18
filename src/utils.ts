import fs from 'fs'
import { Connection, GetProgramAccountsFilter, Keypair, LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import { connection } from "../config";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { SPL_ACCOUNT_LAYOUT, TokenAccount } from "@raydium-io/raydium-sdk";
import { PoolInfo } from "./types";
import { init } from '..'
import { rl } from '../menu/menu';
import path from 'path';
import { bs58 } from '@coral-xyz/anchor/dist/cjs/utils/bytes';
import { createMintAddr } from '../layout/createMintAddr';

export const retrieveEnvVariable = (variableName: string) => {
  const variable = process.env[variableName] || ''
  if (!variable) {
    console.log(`${variableName} is not set`)
    process.exit(1)
  }
  return variable
}

export function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function calcNonDecimalValue(value: number, decimals: number): number {
  return Math.trunc(value * (Math.pow(10, decimals)))
}

export function calcDecimalValue(value: number, decimals: number): number {
  return value / (Math.pow(10, decimals))
}

export async function getNullableResultFromPromise<T>(value: Promise<T>, opt?: { or?: T, logError?: boolean }): Promise<T | null> {
  return value.catch((error) => {
    if (opt) console.log({ error })
    return opt?.or != undefined ? opt.or : null
  })
}

// Define the type for the JSON file content
export interface Data {
  privateKey: string;
  pubkey: string;
}


/**
 *   
 * For Market Creation
 * 
 */

export const EVENT_QUEUE_LENGTH = 2978;
export const EVENT_SIZE = 88;
export const EVENT_QUEUE_HEADER_SIZE = 32;

export const REQUEST_QUEUE_LENGTH = 63;
export const REQUEST_SIZE = 80;
export const REQUEST_QUEUE_HEADER_SIZE = 32;

export const ORDERBOOK_LENGTH = 909;
export const ORDERBOOK_NODE_SIZE = 72;
export const ORDERBOOK_HEADER_SIZE = 40;

export function calculateTotalAccountSize(
  individualAccountSize: number,
  accountHeaderSize: number,
  length: number
) {
  const accountPadding = 12;
  const minRequiredSize =
    accountPadding + accountHeaderSize + length * individualAccountSize;

  const modulo = minRequiredSize % 8;

  return modulo <= 4
    ? minRequiredSize + (4 - modulo)
    : minRequiredSize + (8 - modulo + 4);
}

export function calculateAccountLength(
  totalAccountSize: number,
  accountHeaderSize: number,
  individualAccountSize: number
) {
  const accountPadding = 12;
  return Math.floor(
    (totalAccountSize - accountPadding - accountHeaderSize) /
    individualAccountSize
  );
}

export const outputBalance = async (solAddress: PublicKey) => {
  const bal = await connection.getBalance(solAddress, "processed") / LAMPORTS_PER_SOL
  console.log("Balance in ", solAddress.toBase58(), " is ", bal, "SOL")
  return bal
}

/**
 * 
 *  For pool creation
 * 
 */

export async function getTokenAccountBalance(
  connection: Connection,
  wallet: string,
  mint_token: string
) {
  const filters: GetProgramAccountsFilter[] = [
    {
      dataSize: 165, //size of account (bytes)
    },
    {
      memcmp: {
        offset: 32, //location of our query in the account (bytes)
        bytes: wallet, //our search criteria, a base58 encoded string
      },
    },
    //Add this search parameter
    {
      memcmp: {
        offset: 0, //number of bytes
        bytes: mint_token, //base58 encoded string
      },
    },
  ];
  const accounts = await connection.getParsedProgramAccounts(TOKEN_PROGRAM_ID, {
    filters: filters,
  });

  for (const account of accounts) {
    const parsedAccountInfo: any = account.account.data;
    // const mintAddress: string = parsedAccountInfo["parsed"]["info"]["mint"];
    const tokenBalance: number = parseInt(
      parsedAccountInfo["parsed"]["info"]["tokenAmount"]["amount"]
    );

    // console.log(
    //   `Account: ${account.pubkey.toString()} - Mint: ${mintAddress} - Balance: ${tokenBalance}`
    // );

    if (tokenBalance) {
      return tokenBalance;
    }
  }
}

export function assert(condition: any, msg?: string): asserts condition {
  if (!condition) {
    throw new Error(msg);
  }
}

export async function getWalletTokenAccount(
  connection: Connection,
  wallet: PublicKey
): Promise<TokenAccount[]> {
  const walletTokenAccount = await connection.getTokenAccountsByOwner(wallet, {
    programId: TOKEN_PROGRAM_ID,
  });
  return walletTokenAccount.value.map((i) => ({
    pubkey: i.pubkey,
    programId: i.account.owner,
    accountInfo: SPL_ACCOUNT_LAYOUT.decode(i.account.data),
  }));
}



/**
 * 
 *  Pool remove part
 * 
 */


export async function getATAAddress(
  programId: PublicKey,
  owner: PublicKey,
  mint: PublicKey
) {
  const [publicKey, nonce] = await PublicKey.findProgramAddress(
    [owner.toBuffer(), programId.toBuffer(), mint.toBuffer()],
    new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL")
  );
  return { publicKey, nonce };
}

export function readMintAddrFromFile(filename: string = "./wallets/mintAddr.json"): Keypair {
  try {
    if (!fs.existsSync(filename)) {
      return createMintAddr();
    }
    const data = fs.readFileSync(filename, 'utf-8').trim();
    if (!data) {
      return createMintAddr();
    }
    return Keypair.fromSecretKey(new Uint8Array(bs58.decode(data)));
  } catch (error) {
    console.error("Error reading mint address:", error);
    return createMintAddr();
  }
}

export function readWallets(filename: string = "wallets.json"): string[] {
  try {
    if (!fs.existsSync(filename)) {
      // If the file does not exist, create an empty array
      console.log("Wallets are not set in wallets.json file.")
      return []
    }
    const data = fs.readFileSync(filename, 'utf-8');
    const parsedData = JSON.parse(data)
    return parsedData.wallets
  } catch (error) {
    console.log(error)
    return []
  }
}

export const readBundlerWallets = (filename: string): string[] => {
  const filePath = `wallets/${filename}.json`;
  try {
    if (!fs.existsSync(filePath)) {
      return [];
    }
    const fileContent = fs.readFileSync(filePath, 'utf-8').trim();
    if (!fileContent) {
      return [];
    }
    return JSON.parse(fileContent);
  } catch (error) {
    return [];
  }
};


export const readCreatorWallet = (filename: string = "creator"): string => {
  const filePath = `wallets/${filename}.json`;
  try {
    if (!fs.existsSync(filePath)) {
      return "";
    }
    const fileContent = fs.readFileSync(filePath, 'utf-8').trim();
    if (!fileContent) {
      return "";
    }
    return JSON.parse(fileContent);
  } catch (error) {
    return "";
  }
};

export const saveLUTAddressToFile = (publicKey: string, filePath: string = "wallets/lutAddress.txt") => {
  try {
    // Write the public key to the specified file
    fs.writeFileSync(filePath, publicKey);
    console.log("Public key saved successfully to", filePath);
  } catch (error) {
    console.log('Error saving public key to file:', error);
  }
};

export const readLUTAddressFromFile = (filePath: string = "wallets/lutAddress.txt") => {
  try {
    // Check if the file exists
    if (fs.existsSync(filePath)) {
      // Read the file content
      const publicKey = fs.readFileSync(filePath, 'utf-8');
      return publicKey.trim(); // Remove any surrounding whitespace or newlines
    } else {
      console.log(`File ${filePath} does not exist.`);
      return null; // Return null if the file does not exist
    }
  } catch (error) {
    console.log('Error reading public key from file:', error);
    return null; // Return null in case of error
  }
};

export const saveDataToFile = (newData: PoolInfo, filePath: string = "data.json") => {
  try {

    // Check if the file exists
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      // }
    }

    // Write the updated data back to the file
    fs.writeFileSync(filePath, JSON.stringify(newData, null, 2));

  } catch (error) {
    console.log('Error saving data to JSON file:', error);
  }
};

export const saveVolumeWalletToFile = (newData: Data[], filePath: string = "wallets/volumeWallets.json") => {
  try {
    let existingData: Data[] = [];

    // Check if the file exists
    if (fs.existsSync(filePath)) {
      // If the file exists, read its content
      const fileContent = fs.readFileSync(filePath, 'utf-8');
      existingData = JSON.parse(fileContent);
    }

    // Add the new data to the existing array
    existingData.push(...newData);

    // Write the updated data back to the file
    fs.writeFileSync(filePath, JSON.stringify(existingData, null, 2));

  } catch (error) {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log(`File ${filePath} deleted and create new file.`);
      }
      fs.writeFileSync(filePath, JSON.stringify(newData, null, 2));
      console.log("File is saved successfully.")
    } catch (error) {
      console.log('Error saving data to JSON file:', error);
    }
  }
};

export const saveHolderWalletsToFile = (newData: Data[], filePath: string = "wallets/holderWallets.json") => {
  try {
    let existingData: Data[] = [];

    // Check if the file exists
    if (fs.existsSync(filePath)) {
      // If the file exists, read its content
      const fileContent = fs.readFileSync(filePath, 'utf-8');
      existingData = JSON.parse(fileContent);
    }

    // Add the new data to the existing array
    existingData.push(...newData);

    // Write the updated data back to the file
    fs.writeFileSync(filePath, JSON.stringify(existingData, null, 2));

  } catch (error) {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log(`File ${filePath} deleted and create new file.`);
      }
      fs.writeFileSync(filePath, JSON.stringify(newData, null, 2));
      console.log("File is saved successfully.")
    } catch (error) {
      console.log('Error saving data to JSON file:', error);
    }
  }
};

export const saveBundlerWalletsToFile = (newData: string[], filename: string = "wallets") => {
  const filePath: string = `wallets/${filename}.json`;
  
  try {
    // Create the wallets directory if it doesn't exist
    const dirPath = path.dirname(filePath);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
      console.log(`Directory ${dirPath} created.`);
    }

    // Write the new data to the file (this will create the file if it doesn't exist)
    fs.writeFileSync(filePath, JSON.stringify(newData, null, 2));
    console.log(`File ${filePath} saved successfully.`);

  } catch (error) {
    console.log('Error saving data to JSON file:', error);
  }
};


export const saveCreatorWalletToFile = (newData: string, filename: string = "creator") => {
  const filePath: string = `wallets/${filename}.json`;
  
  try {
    // Create the wallets directory if it doesn't exist
    const dirPath = path.dirname(filePath);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
      console.log(`Directory ${dirPath} created.`);
    }

    // Write the new data to the file (this will create the file if it doesn't exist)
    fs.writeFileSync(filePath, JSON.stringify(newData, null, 2));
    console.log(`File ${filePath} saved successfully.`);

  } catch (error) {
    console.log('Error saving data to JSON file:', error);
  }
};

// Function to read JSON file
export function readVolumeWalletDataJson(filename: string = "wallets/volumeWallets.json"): Data[] {
  if (!fs.existsSync(filename)) {
      // If the file does not exist, create an empty array
      fs.writeFileSync(filename, '[]', 'utf-8');
  }
  const data = fs.readFileSync(filename, 'utf-8');
  return JSON.parse(data) as Data[];
}

// Function to read JSON file
export function readHolderWalletDataJson(filename: string = "wallets/holderWallets.json"): Data[] {
  if (!fs.existsSync(filename)) {
      // If the file does not exist, create an empty array
      fs.writeFileSync(filename, '[]', 'utf-8');
  }
  const data = fs.readFileSync(filename, 'utf-8');
  return JSON.parse(data) as Data[];
}

export const mainMenuWaiting = () => {
  rl.question('press Enter key to continue', (answer: string) => {
    init()
  })
}