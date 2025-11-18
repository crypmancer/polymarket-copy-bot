import { Keypair, LAMPORTS_PER_SOL, SystemProgram, TransactionInstruction, TransactionMessage, VersionedTransaction } from "@solana/web3.js";
import { ComputeBudgetProgram } from "@solana/web3.js";
import bs58 from 'bs58';
import { connection, cluster } from "../../config";
import { FileUtils } from "../utils/fileUtils";
import { AsyncUtils } from "../utils/asyncUtils";
import { execute } from "../legacy";

/**
 * Wallet Service - Handles wallet creation and SOL distribution
 */
export class WalletService {
  /**
   * Create new wallet and save to file (base58 format)
   */
  static createAndSaveWallet(): string {
    const newWallet = Keypair.generate();
    const walletString = bs58.encode(newWallet.secretKey);
    FileUtils.saveCreatorWalletToFile(walletString);
    return walletString;
  }

  /**
   * Distribute SOL to a wallet
   */
  static async distributeSOL(
    fromKeypair: Keypair,
    toPublicKey: string,
    solAmount: number,
    additionalLamports: number = 0.035 * LAMPORTS_PER_SOL
  ): Promise<string | null> {
    // Wallet string is base58 encoded, decode it to get the keypair
    const toKeypair = Keypair.fromSecretKey(bs58.decode(toPublicKey));
    
    const instructions: TransactionInstruction[] = [
      ComputeBudgetProgram.setComputeUnitLimit({ units: 100_000 }),
      ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 250_000 }),
      SystemProgram.transfer({
        fromPubkey: fromKeypair.publicKey,
        toPubkey: toKeypair.publicKey,
        lamports: Math.ceil((solAmount * LAMPORTS_PER_SOL) + additionalLamports)
      })
    ];

    return await AsyncUtils.retry(
      async () => {
        const latestBlockhash = await connection.getLatestBlockhash();
        const messageV0 = new TransactionMessage({
          payerKey: fromKeypair.publicKey,
          recentBlockhash: latestBlockhash.blockhash,
          instructions,
        }).compileToV0Message();

        const transaction = new VersionedTransaction(messageV0);
        transaction.sign([fromKeypair]);

        const txSig = await execute(transaction, latestBlockhash, 1);
        if (txSig) {
          const txUrl = `https://solscan.io/tx/${txSig}${cluster === "devnet" ? "?cluster=devnet" : ""}`;
          console.log("SOL distributed:", txUrl);
          return txSig;
        }
        return null;
      },
      3,
      1000
    ).catch((error) => {
      console.error("Error distributing SOL after retries:", error);
      return null;
    });
  }
}

