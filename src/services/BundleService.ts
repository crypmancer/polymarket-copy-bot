import { Keypair, LAMPORTS_PER_SOL, PublicKey, TransactionMessage, VersionedTransaction } from "@solana/web3.js";
import { ComputeBudgetProgram } from "@solana/web3.js";
import { createAssociatedTokenAccountIdempotentInstruction, getAssociatedTokenAddress, getAccount } from "@solana/spl-token";
import { connection } from "../../config";
import { COMPUTE_UNIT_PRICE, COMPUTE_UNIT_LIMIT, DEFAULT_TOKEN_AMOUNT, DEFAULT_SOL_AMOUNT, WALLET_PATHS } from "../constants";
import { INITIAL_VIRTUAL_SOL_RESERVES, INITIAL_VIRTUAL_TOKEN_RESERVES, PumpfunService } from "./PumpfunService";
import { MetadataService } from "./MetadataService";
import { TokenMetadata } from "../types/pumpfun";
import { FileUtils } from "../utils/fileUtils";
import bs58 from "bs58";
import { DEV_BUY_SOL_AMOUNT, WALLET_BUY_SOL_AMOUNT } from "../../settings";

/**
 * Bundle Service - Handles bundle transaction creation and sending
 */
export class BundleService {
  /**
   * Create bundle pool buy transaction
   */
  static async createBundlePoolBuy(
    mint: Keypair,
    creatorKeypair: Keypair,
    tokenMetadata: TokenMetadata
  ): Promise<VersionedTransaction[]> {
    try {
      
      const versionedTxs: VersionedTransaction[] = [];
  
      const secondWallet = FileUtils.readSecondWallet();
      const secondKeypair = Keypair.fromSecretKey(bs58.decode(secondWallet));
  
      // Parallelize independent async operations
      const [metadataResponse, bondingCurvePDA, associatedUser, recentBlockhash] = await Promise.all([
        MetadataService.createTokenMetadata(tokenMetadata),
        getAssociatedTokenAddress(
          mint.publicKey,
          PumpfunService.getBondingCurvePDA(mint.publicKey),
          true
        ),
        getAssociatedTokenAddress(mint.publicKey, creatorKeypair.publicKey),
        connection.getLatestBlockhash().then(b => b.blockhash)
      ]);
  
      // Create token instruction
      const createIx = await PumpfunService.createTokenInstruction(
        metadataResponse,
        mint.publicKey,
        creatorKeypair.publicKey,
        bondingCurvePDA
      );
  
      // Create ATA instruction
      const createAtaIx = createAssociatedTokenAccountIdempotentInstruction(
        creatorKeypair.publicKey,
        associatedUser,
        creatorKeypair.publicKey,
        mint.publicKey
      );
  
      const buySolAmount = DEV_BUY_SOL_AMOUNT * LAMPORTS_PER_SOL;
  
      const buyTokenAmount = PumpfunService.ammBuyGetTokenOut(INITIAL_VIRTUAL_SOL_RESERVES, INITIAL_VIRTUAL_TOKEN_RESERVES, buySolAmount);
  
      // Create buy instruction
      const buyIx = await PumpfunService.createBuyInstruction(
        buyTokenAmount,
        DEFAULT_SOL_AMOUNT,
        mint.publicKey,
        creatorKeypair.publicKey,
        creatorKeypair.publicKey
      );
  
      // Create first transaction
      const createTx = new VersionedTransaction(
        new TransactionMessage({
          payerKey: creatorKeypair.publicKey,
          recentBlockhash,
          instructions: [
            ...createIx.instructions,
            createAtaIx,
            ...(buyIx?.instructions || [])
          ],
        }).compileToV0Message()
      );
  
      createTx.sign([creatorKeypair, mint]);
      versionedTxs.push(createTx);
  
      const walletBuySolAmount = WALLET_BUY_SOL_AMOUNT * LAMPORTS_PER_SOL;
      const walletBuyTokenAmount = PumpfunService.ammBuyGetTokenOut(INITIAL_VIRTUAL_SOL_RESERVES + buySolAmount, INITIAL_VIRTUAL_TOKEN_RESERVES - buyTokenAmount, walletBuySolAmount);
  
      const firstBuyTx = await PumpfunService.createMultiBuyTransaction(
        walletBuyTokenAmount,
        walletBuySolAmount * 2,
        mint.publicKey,
        [secondKeypair],
        creatorKeypair.publicKey
      );
  
      versionedTxs.push(firstBuyTx);
  
      return versionedTxs;
    } catch (error) {
      console.error("Error in createBundlePoolBuy:", error);
      return [];
    }
  }

  /**
   * Sell all tokens from all wallets that have balance
   */
  static async sellAllTokensFromAllWallets(mainKp: Keypair): Promise<VersionedTransaction | null> {
    try {
      // Read mint address and wallets
      const mint = FileUtils.readMintAddrFromFile();
      // creator/
      const creatorWallet = Keypair.fromSecretKey(bs58.decode(FileUtils.readCreatorWallet()));

      // second wallet
      const secondWallet = Keypair.fromSecretKey(bs58.decode(FileUtils.readSecondWallet()));

      // third wallet
      const thirdWallet = Keypair.fromSecretKey(bs58.decode(FileUtils.readThirdWallet()));

      // Get token balances for all wallets in parallel
      const walletBalances = new Map<string, number>();
      const balancePromises = [creatorWallet, secondWallet, thirdWallet].map(async (wallet) => {
        try {
          const tokenAta = await getAssociatedTokenAddress(
            mint.publicKey,
            wallet.publicKey,
            true
          );

          try {
            const accountInfo = await getAccount(connection, tokenAta);
            const balance = Number(accountInfo.amount);
            walletBalances.set(wallet.publicKey.toString(), balance);

            if (balance > 0) {
              console.log(`Wallet ${wallet.publicKey.toString()}: ${balance} tokens`);
            }
          } catch (error) {
            // Token account doesn't exist or has no balance
            walletBalances.set(wallet.publicKey.toString(), 0);
          }
        } catch (error) {
          console.error(`Error getting balance for wallet ${wallet.publicKey.toString()}:`, error);
          walletBalances.set(wallet.publicKey.toString(), 0);
        }
      });

      await Promise.all(balancePromises);

      // Filter wallets with balance > 0
      const walletsWithBalance = [creatorWallet, secondWallet, thirdWallet].filter(wallet => {
        const balance = walletBalances.get(wallet.publicKey.toString()) || 0;
        return balance > 0;
      });

      if (walletsWithBalance.length === 0) {
        console.log("No wallets with token balance found");
        return null;
      }

      console.log(`Found ${walletsWithBalance.length} wallets with token balance. Creating sell transaction...`);

      // Use creator wallet as payer if available, otherwise use first wallet with balance
      // The creator wallet should have SOL for transaction fees
      let payerKeypair: Keypair | null = null;
      let allSigners = [...walletsWithBalance];

      try {
        const creatorPk = FileUtils.readCreatorWallet();
        if (creatorPk) {
          payerKeypair = Keypair.fromSecretKey(bs58.decode(creatorPk));
          console.log(`Using creator wallet as payer: ${payerKeypair.publicKey.toString()}`);

          // Add creator to signers if it's not already there (needed if it's the payer)
          if (!allSigners.some(w => w.publicKey.equals(payerKeypair!.publicKey))) {
            allSigners.push(payerKeypair);
          }
        }
      } catch (error) {
        console.log("Could not use creator wallet as payer, using first wallet with balance");
      }

      // Create multi-sell transaction
      // Pass allSigners (wallets with balance + payer if different) so payer can sign
      const sellTx = await PumpfunService.createMultiSellTransaction(
        mint.publicKey,
        allSigners,
        walletBalances,
        payerKeypair?.publicKey
      );

      if (!sellTx) {
        console.log("Failed to create sell transaction");
        return null;
      }

      console.log("Sell transaction created successfully");
      return sellTx;
    } catch (error) {
      console.error("Error in sellAllTokensFromAllWallets:", error);
      return null;
    }
  }

  /**
   * Create bundle pool sell from second wallet and buy same amount of tokens second wallet sold using third wallet
   */
  static async createBundlePoolSellFromSecondWallet(
    mint: Keypair,
    secondKeypair: Keypair,
    thirdKeypair: Keypair,
    creatorKeypair: Keypair
  ): Promise<VersionedTransaction[] | null> {
    const recentBlockhash = await connection.getLatestBlockhash().then(b => b.blockhash);
    try {
      const tokenAta = await getAssociatedTokenAddress(
        mint.publicKey,
        secondKeypair.publicKey,
        true
      );
      const accountInfo = await getAccount(connection, tokenAta);
      const balance = Number(accountInfo.amount);

      if (balance === 0) {
        console.log("No balance found in second wallet");
        return null;
      }

      // Create sell instruction
      const sellIx = await PumpfunService.createSellInstruction(
        balance,
        0,
        mint.publicKey,
        secondKeypair.publicKey
      );

      const sellTxMessage = new TransactionMessage({
        payerKey: secondKeypair.publicKey,
        recentBlockhash,
        instructions: [
          ...sellIx.instructions,
        ]
      }).compileToV0Message();

      const sellTx = new VersionedTransaction(sellTxMessage);
      sellTx.sign([secondKeypair]);

      // Create buy instruction
      const buyIx = await PumpfunService.createMultiBuyTransaction(
        balance,
        LAMPORTS_PER_SOL * 50,
        mint.publicKey,
        [thirdKeypair],
        creatorKeypair.publicKey
      );

      return [sellTx, buyIx];


    } catch (error) {
      // Token account doesn't exist or has no balance
      console.error("Error in createBundlePoolSellFromSecondWallet:", error);
      return null;
    }
  }
}

