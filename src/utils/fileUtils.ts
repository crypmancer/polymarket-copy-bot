import fs from 'fs';
import path from 'path';
import { Keypair } from "@solana/web3.js";
import { bs58 } from '@coral-xyz/anchor/dist/cjs/utils/bytes';
import { WALLET_PATHS } from '../constants';
import { createMintAddr } from '../../layout/createMintAddr';

/**
 * File Utilities - Handle file I/O operations
 */
export class FileUtils {
  /**
   * Read JSON file safely
   */
  static readJsonFile<T>(filePath: string, defaultValue: T): T {
    try {
      if (!fs.existsSync(filePath)) {
        return defaultValue;
      }
      const content = fs.readFileSync(filePath, 'utf-8').trim();
      if (!content) {
        return defaultValue;
      }
      return JSON.parse(content);
    } catch (error) {
      console.error(`Error reading file ${filePath}:`, error);
      return defaultValue;
    }
  }

  /**
   * Write JSON file safely
   */
  static writeJsonFile<T>(filePath: string, data: T): void {
    try {
      const dirPath = path.dirname(filePath);
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
      }
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error(`Error writing file ${filePath}:`, error);
      throw error;
    }
  }

  /**
   * Read text file safely
   */
  static readTextFile(filePath: string): string | null {
    try {
      if (!fs.existsSync(filePath)) {
        return null;
      }
      return fs.readFileSync(filePath, 'utf-8').trim();
    } catch (error) {
      console.error(`Error reading text file ${filePath}:`, error);
      return null;
    }
  }

  /**
   * Write text file safely
   */
  static writeTextFile(filePath: string, content: string): void {
    try {
      const dirPath = path.dirname(filePath);
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
      }
      fs.writeFileSync(filePath, content);
    } catch (error) {
      console.error(`Error writing text file ${filePath}:`, error);
      throw error;
    }
  }

  /**
   * Read mint address from file
   */
  static readMintAddrFromFile(filename: string = WALLET_PATHS.MINT_ADDR): Keypair {
    try {
      if (!fs.existsSync(filename)) {
        return createMintAddr();
      }
      const data = fs.readFileSync(filename, 'utf-8').trim();
      if (!data) {
        return createMintAddr();
      }
      // Handle both JSON and plain string formats
      const decoded = data.startsWith('"') ? JSON.parse(data) : data;
      return Keypair.fromSecretKey(new Uint8Array(bs58.decode(decoded)));
    } catch (error) {
      console.error("Error reading mint address:", error);
      return createMintAddr();
    }
  }

  /**
   * Read creator wallet from file (parses JSON)
   */
  static readCreatorWallet(filename: string = WALLET_PATHS.CREATOR): string {
    const content = this.readTextFile(filename);
    if (!content) return "";
    try {
      return JSON.parse(content);
    } catch {
      // If not valid JSON, return as-is (backward compatibility)
      return content;
    }
  }

  static readSecondWallet(filename: string = WALLET_PATHS.SECOND_WALLET): string {
    const content = this.readTextFile(filename);
    if (!content) return "";
    try {
      return JSON.parse(content);
    } catch {
      // If not valid JSON, return as-is (backward compatibility)
      return content;
    }
  }

  static readThirdWallet(filename: string = WALLET_PATHS.THIRD_WALLET): string {
    const content = this.readTextFile(filename);
    if (!content) return "";
    try {
      return JSON.parse(content);
    } catch {
      // If not valid JSON, return as-is (backward compatibility)
      return content;
    }
  }

  /**
   * Save creator wallet to file (as JSON string)
   */
  static saveCreatorWalletToFile(wallet: string, filename: string = WALLET_PATHS.CREATOR): void {
    this.writeTextFile(filename, JSON.stringify(wallet));
  }

  /**
   * Read bundler wallets from file
   */
  static readBundlerWallets(filename: string = "wallets"): string[] {
    const filePath = `wallets/${filename}.json`;
    return this.readJsonFile<string[]>(filePath, []);
  }

}

