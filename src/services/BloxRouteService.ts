import { Connection, Keypair, VersionedTransaction, TransactionMessage, SystemProgram, LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js';
import axios, { AxiosResponse } from 'axios';
import { BLOXROUTE_SUBMIT_BATCH_URL, DEFAULT_TIP_AMOUNT_SOL, BLOXROUTE_TIP_ACCOUNTS } from '../constants';

/**
 * BloxRoute Service - Handles bundle submission via BloxRoute
 */
export class BloxRouteService {
  private connection: Connection;

  constructor(connection: Connection) {
    this.connection = connection;
  }

  /**
   * Get random tip account
   */
  private getTipAccount(): string {
    const randomIndex = Math.floor(Math.random() * BLOXROUTE_TIP_ACCOUNTS.length);
    const tipAccount = BLOXROUTE_TIP_ACCOUNTS[randomIndex];
    
    if (!tipAccount) {
      throw new Error('BloxRoute: no tip accounts available');
    }
    
    return tipAccount;
  }

  /**
   * Create tip transaction
   */
  private async createTipTransaction(payer: Keypair): Promise<VersionedTransaction> {
    const tipAccount = this.getTipAccount();
    const tipInstruction = SystemProgram.transfer({
      fromPubkey: payer.publicKey,
      toPubkey: new PublicKey(tipAccount),
      lamports: Math.floor(DEFAULT_TIP_AMOUNT_SOL * LAMPORTS_PER_SOL)
    });

    const { blockhash } = await this.connection.getLatestBlockhash();
    
    const messageV0 = new TransactionMessage({
      payerKey: payer.publicKey,
      recentBlockhash: blockhash,
      instructions: [tipInstruction]
    }).compileToV0Message();

    const transaction = new VersionedTransaction(messageV0);
    transaction.sign([payer]);

    return transaction;
  }

  /**
   * Send bundle via BloxRoute
   */
  async sendBundle(transactions: VersionedTransaction[], payer: Keypair): Promise<void> {

    // Simulate all transactions
    for (const tx of transactions) {
      const simulatedTransaction = await this.connection.simulateTransaction(tx);
      if (simulatedTransaction.value.err) {
        console.error("Simulation failed:", simulatedTransaction.value.err);
        continue;
      }
    }
    
    const bundleTransactions = [...transactions];
    const tipTransaction = await this.createTipTransaction(payer);
    bundleTransactions.push(tipTransaction);

    // Convert transactions to base64 strings
    const entries = bundleTransactions.map(tx => {
      const serializedTx = tx.serialize();
      const base64Content = Buffer.from(serializedTx).toString('base64');
      return {
        transaction: {
          content: base64Content
        }
      };
    });

    const requestBody = { entries };

    const authToken = process.env.BLOXROUTE_AUTH_TOKEN;
    if (!authToken) {
      throw new Error('BLOXROUTE_AUTH_TOKEN environment variable not set');
    }

    try {
      const response: AxiosResponse = await axios.post(
        BLOXROUTE_SUBMIT_BATCH_URL,
        requestBody,
        {
          headers: {
            'Authorization': authToken,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.status >= 200 && response.status < 300) {
        const signature = response.data?.transactions;
        console.log('BloxRoute bundle submitted successfully:', signature);
      } else {
        const errorText = response.data || 'Unknown error';
        throw new Error(`BloxRoute API error: ${response.status} - ${errorText}`);
      }
    } catch (error: any) {
      if (error.response) {
        const errorText = error.response.data || 'Unknown error';
        throw new Error(`BloxRoute API error: ${error.response.status} - ${errorText}`);
      } else {
        throw new Error(`BloxRoute request failed: ${error.message}`);
      }
    }
  }
}

