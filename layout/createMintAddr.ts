import { bs58 } from "@coral-xyz/anchor/dist/cjs/utils/bytes";
import { Keypair, PublicKey } from "@solana/web3.js";
import fs from "fs";

export const createMintAddr = (): Keypair => {
    // generate address that ends with pump and save to file
    try {
        const mintAddr = Keypair.generate();
        // if (mintAddr.publicKey.toString().endsWith("pump")) {
        fs.writeFileSync("./wallets/mintAddr.json", JSON.stringify(bs58.encode(mintAddr.secretKey)));
        console.log("Mint address created successfully");
        console.log("Mint address: ", mintAddr.publicKey.toString());
        return Keypair.fromSecretKey(new Uint8Array(bs58.decode(bs58.encode(mintAddr.secretKey))));
    } catch (error) {
        console.log("Error in creating mint address", error);
        throw new Error("Error in creating mint address");
    }
}