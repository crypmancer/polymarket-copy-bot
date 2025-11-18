import { AnchorProvider, Program, setProvider } from "@coral-xyz/anchor";
import NodeWallet from "@coral-xyz/anchor/dist/cjs/nodewallet";
import { Keypair, PublicKey, Transaction, TransactionInstruction, TransactionMessage, VersionedTransaction } from "@solana/web3.js";
import { ComputeBudgetProgram } from "@solana/web3.js";
import { createAssociatedTokenAccountIdempotentInstruction, createCloseAccountInstruction, getAssociatedTokenAddress } from "@solana/spl-token";
import { PumpFun } from "../idl/idl";
import PumpfunIDL from "../idl/idl.json";
import { connection } from "../../config";
import { BN } from "bn.js";
import { PUMP_FEE_RECEIVER, COMPUTE_UNIT_PRICE, COMPUTE_UNIT_LIMIT } from "../constants";
import { TokenMetadataResponse } from "../types/pumpfun";

export const INITIAL_VIRTUAL_TOKEN_RESERVES: number = 1_073_000_000_000_000;
export const INITIAL_VIRTUAL_SOL_RESERVES: number = 30_000_000_000;
/**
 * Pumpfun Service - Handles all Pump.fun program interactions
 */
export class PumpfunService {
  private static program: Program<PumpFun>;
  private static provider: AnchorProvider;

  static initialize() {
    if (!this.program) {
      this.provider = new AnchorProvider(
        connection,
        new NodeWallet(Keypair.generate()),
        { commitment: "confirmed" }
      );
      setProvider(this.provider);
      this.program = new Program<PumpFun>(PumpfunIDL as PumpFun, this.provider);
    }
    return this.program;
  }

  static getProgram(): Program<PumpFun> {
    if (!this.program) {
      this.initialize();
    }
    return this.program;
  }

  /**
   * Get bonding curve PDA for a mint
   */
  static getBondingCurvePDA(mint: PublicKey): PublicKey {
    const program = this.getProgram();
    return PublicKey.findProgramAddressSync(
      [Buffer.from("bonding-curve"), mint.toBuffer()],
      program.programId
    )[0];
  }

  /**
   * Get creator vault PDA
   */
  static getCreatorVaultPDA(creator: PublicKey): PublicKey {
    const program = this.getProgram();
    const [creatorVault] = PublicKey.findProgramAddressSync(
      [Buffer.from("creator-vault"), creator.toBuffer()],
      program.programId
    );
    return creatorVault;
  }

  /**
   * Create token creation instruction
   */
  static async createTokenInstruction(
    metadata: TokenMetadataResponse,
    mint: PublicKey,
    user: PublicKey,
    associatedBondingCurve: PublicKey
  ): Promise<Transaction> {
    const program = this.getProgram();
    
    
    return await program.methods
      .create(
        metadata.metadata.name,
        metadata.metadata.symbol,
        metadata.metadataUri,
        user
      )
      .accounts({
        program: program.programId,
        mint,
        user,
      })
      .accountsPartial({
        associatedBondingCurve,
      })
      .transaction();
  }

  /**
   * Create buy instruction
   */
  static async createBuyInstruction(
    tokenAmount: number,
    solAmount: number,
    mint: PublicKey,
    user: PublicKey,
    creator: PublicKey
  ): Promise<Transaction> {
    console.log("Creating buy instruction for token amount: ", tokenAmount, " and sol amount: ", solAmount);
    const program = this.getProgram();
    const bondingCurve = this.getBondingCurvePDA(mint);
    
    const [associatedUser, associatedBondingCurve] = await Promise.all([
      getAssociatedTokenAddress(mint, user, true),
      getAssociatedTokenAddress(mint, bondingCurve, true)
    ]);

    const creatorVault = this.getCreatorVaultPDA(creator);

    return await program.methods
      .buy(new BN(tokenAmount), new BN(solAmount), { "0": true } as any)
      .accountsPartial({
        user,
        associatedUser,
        mint,
        feeRecipient: PUMP_FEE_RECEIVER,
        creatorVault,
        associatedBondingCurve,
      })
      .transaction();
  }

  /**
   * Create multi-buy transaction for multiple users
   */
  static async createMultiBuyTransaction(
    tokenAmount: number,
    solAmount: number,
    mint: PublicKey,
    users: Keypair[],
    creator: PublicKey
  ): Promise<VersionedTransaction> {
    const instructions: TransactionInstruction[] = [
      ComputeBudgetProgram.setComputeUnitLimit({ units: 300_000 }),
      ComputeBudgetProgram.setComputeUnitPrice({ microLamports: COMPUTE_UNIT_PRICE })
    ];

    // Parallelize user data fetching
    const userData = await Promise.all(
      users.map(async (user) => {
        const [tokenAta, buyIx] = await Promise.all([
          getAssociatedTokenAddress(mint, user.publicKey, true),
          this.createBuyInstruction(tokenAmount, solAmount, mint, user.publicKey, creator)
        ]);
        return { user, tokenAta, buyIx };
      })
    );

    // Build instructions sequentially
    for (const { user, tokenAta, buyIx } of userData) {
      instructions.push(
        createAssociatedTokenAccountIdempotentInstruction(
          user.publicKey,
          tokenAta,
          user.publicKey,
          mint
        ),
        ...(buyIx?.instructions || [])
      );
    }

    const { blockhash } = await connection.getLatestBlockhash();
    const transaction = new VersionedTransaction(
      new TransactionMessage({
        payerKey: users[0].publicKey,
        recentBlockhash: blockhash,
        instructions,
      }).compileToV0Message()
    );

    transaction.sign(users);
    return transaction;
  }

  /**
   * Create sell instruction
   */
  static async createSellInstruction(
    tokenAmount: number,
    minSolOutput: number,
    mint: PublicKey,
    user: PublicKey
  ): Promise<Transaction> {
    const program = this.getProgram();
    const bondingCurve = this.getBondingCurvePDA(mint);
    
    const [associatedUser, associatedBondingCurve] = await Promise.all([
      getAssociatedTokenAddress(mint, user, true),
      getAssociatedTokenAddress(mint, bondingCurve, true)
    ]);

    // CreatorVault is derived from bonding_curve.creator, Anchor will derive it automatically
    return await program.methods
      .sell(new BN(tokenAmount), new BN(minSolOutput))
      .accountsPartial({
        user,
        associatedUser,
        mint,
        feeRecipient: PUMP_FEE_RECEIVER,
        associatedBondingCurve,
        bondingCurve,
      })
      .transaction();
  }

  /**
   * Create multi-sell transaction for multiple users
   */
  static async createMultiSellTransaction(
    mint: PublicKey,
    users: Keypair[],
    walletBalances: Map<string, number>,
    payerKey?: PublicKey
  ): Promise<VersionedTransaction | null> {
    const instructions: TransactionInstruction[] = [
      ComputeBudgetProgram.setComputeUnitLimit({ units: COMPUTE_UNIT_LIMIT }),
      ComputeBudgetProgram.setComputeUnitPrice({ microLamports: COMPUTE_UNIT_PRICE })
    ];

    // Filter wallets with balance > 0 and create sell instructions
    const walletsWithBalance = users.filter(user => {
      const balance = walletBalances.get(user.publicKey.toString());
      return balance && balance > 0;
    });

    if (walletsWithBalance.length === 0) {
      return null;
    }

    // Determine payer - use provided payerKey or first wallet with balance
    const payer = payerKey || walletsWithBalance[0].publicKey;

    // Parallelize user data fetching
    const userData = await Promise.all(
      walletsWithBalance.map(async (user) => {
        const balance = walletBalances.get(user.publicKey.toString()) || 0;
        const tokenAta = await getAssociatedTokenAddress(mint, user.publicKey, true);
        // Set minSolOutput to 0 to accept any amount (can be adjusted for slippage protection)
        const sellIx = await this.createSellInstruction(balance, 0, mint, user.publicKey);
        return { user, tokenAta, sellIx };
      })
    );

    // Build instructions sequentially
    for (const { user, tokenAta, sellIx } of userData) {
      instructions.push(
        ...(sellIx?.instructions || []),
        createCloseAccountInstruction(tokenAta, user.publicKey, user.publicKey)
      );
    }

    if (instructions.length <= 2) { // Only compute budget instructions
      return null;
    }

    const { blockhash } = await connection.getLatestBlockhash();
    const transaction = new VersionedTransaction(
      new TransactionMessage({
        payerKey: payer,
        recentBlockhash: blockhash,
        instructions,
      }).compileToV0Message()
    );

    // Sign with all users (should include wallets with balance + payer if different)
    // All wallets with balance need to sign their sell instructions
    // Payer also needs to sign to pay transaction fees
    transaction.sign(users);
    return transaction;
  }

  static ammBuyGetTokenOut(solReserve: number, tokenReserve: number, solIn: number): number {
    if (solIn === 0 || solReserve === 0 || tokenReserve === 0) {
        return 0;
    }

    const invariant = solReserve * tokenReserve;
    const newSolReserve = solReserve + solIn;

    const newTokenReserve = invariant / newSolReserve;
    const tokenOut = tokenReserve - newTokenReserve;

    return tokenOut;
}
}

