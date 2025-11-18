/**
 * Pump.fun Token Metadata Types
 */
export interface TokenMetadata {
  name: string;
  symbol: string;
  description: string;
  twitter?: string;
  telegram?: string;
  website?: string;
}

export interface TokenMetadataResponse {
  metadata: {
    name: string;
    symbol: string;
  };
  metadataUri: string;
}

/**
 * Bundle Transaction Types
 */
export interface BundleTransactionResult {
  success: boolean;
  signature?: string;
  error?: string;
}

export interface CreateTransactionParams {
  tokenAmount: number;
  solAmount: number;
  mint: string;
  user: string;
  creator?: string;
}

