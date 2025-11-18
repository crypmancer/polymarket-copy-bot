// TODO: check all wallets of balance, creator/second/third
import { Keypair } from "@solana/web3.js";
import { connection } from "../config";
import { FileUtils } from "../src/utils/fileUtils";
import base58 from "bs58";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import { mainMenuWaiting } from "../src/legacyUtils";

export const checkAllWalletsBalance = async (): Promise<void> => {
    const creatorWallet = FileUtils.readCreatorWallet();
    if (!creatorWallet) {
        throw new Error("Creator wallet not found");
    }
    const creatorKeypair = Keypair.fromSecretKey(base58.decode(creatorWallet));
    const secondWallet = FileUtils.readSecondWallet();
    if (!secondWallet) {
        throw new Error("Second wallet not found");
    }
    const secondKeypair = Keypair.fromSecretKey(base58.decode(secondWallet));
    const thirdWallet = FileUtils.readThirdWallet();
    if (!thirdWallet) {
        throw new Error("Third wallet not found");
    }
    const thirdKeypair = Keypair.fromSecretKey(base58.decode(thirdWallet));
    const creatorBalance = await connection.getBalance(creatorKeypair.publicKey);
    console.log("Creator address: ", creatorKeypair.publicKey.toString());
    console.log(`Creator balance: ${creatorBalance / LAMPORTS_PER_SOL} SOL`);
    const secondBalance = await connection.getBalance(secondKeypair.publicKey);
    console.log("Second address: ", secondKeypair.publicKey.toString());
    console.log(`Second balance: ${secondBalance / LAMPORTS_PER_SOL} SOL`);
    const thirdBalance = await connection.getBalance(thirdKeypair.publicKey);
    console.log("Third address: ", thirdKeypair.publicKey.toString());
    console.log(`Third balance: ${thirdBalance / LAMPORTS_PER_SOL} SOL`);
    mainMenuWaiting();
}