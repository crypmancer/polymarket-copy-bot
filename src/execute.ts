import { Connection, Keypair, Transaction, VersionedTransaction } from "@solana/web3.js";
import { cluster, connection } from "../config";


interface Blockhash {
  blockhash: string;
  lastValidBlockHeight: number;
}


export const executeVersionedTx = async (transaction: VersionedTransaction) => {
  const latestBlockhash = await connection.getLatestBlockhash()
  const signature = await connection.sendRawTransaction(transaction.serialize(), { skipPreflight: true })

  const confirmation = await connection.confirmTransaction(
    {
      signature,
      lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
      blockhash: latestBlockhash.blockhash,
    }
  );

  if (confirmation.value.err) {
    console.log("Confirmation error", confirmation.value.err)
    return ""
  } else {
    console.log(`Confirmed transaction: https://solscan.io/tx/${signature}${cluster == "devnet" ? "?cluster=devnet" : ""}`)
  }
  return signature
}


export const executeLegacyTx = async (transaction: Transaction, signer: Keypair[], latestBlockhash: Blockhash) => {

  const signature = await connection.sendTransaction(transaction, signer, { skipPreflight: true })
  const confirmation = await connection.confirmTransaction(
    {
      signature,
      lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
      blockhash: latestBlockhash.blockhash,
    }
  );
  if (confirmation.value.err) {
    console.log("Confirmation error")
    return null
  } else {
    console.log(`Confirmed transaction: https://solscan.io/tx/${signature}${cluster == "devnet" ? "?cluster=devnet" : ""}`)
  }
  return signature
}
