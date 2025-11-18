import { VersionedTransaction } from "@solana/web3.js";
import { cluster, connection } from "../config";


interface Blockhash {
  blockhash: string;
  lastValidBlockHeight: number;
}

export const execute = async (transaction: VersionedTransaction, latestBlockhash: Blockhash, isBuy: boolean | 1 = true) => {

  const signature = await connection.sendRawTransaction(transaction.serialize(), { skipPreflight: true })
  const confirmation = await connection.confirmTransaction(
    {
      signature,
      lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
      blockhash: latestBlockhash.blockhash,
    }
  );

  if (confirmation.value.err) {
    console.log("Confirmation error")
    return ""
  } else {
    if(isBuy === 1){
      return signature
    } else if (isBuy)
      console.log(`Success in buy transaction: https://solscan.io/tx/${signature}${cluster == "devnet" ? "?cluster=devnet" : ""}`)
    else
      console.log(`Success in Sell transaction: https://solscan.io/tx/${signature}${cluster == "devnet" ? "?cluster=devnet" : ""}`)
  }
  return signature
}
