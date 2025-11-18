import { Agent, setGlobalDispatcher } from "undici";
import { openAsBlob } from "fs";
import { TokenMetadata, TokenMetadataResponse } from "../types/pumpfun";
import { METADATA_API_URL, METADATA_IMAGE_PATH, METADATA_API_HEADERS } from "../constants";

/**
 * Metadata Service - Handles token metadata creation and upload
 */
export class MetadataService {
  /**
   * Create and upload token metadata to IPFS
   */
  static async createTokenMetadata(
    metadata: TokenMetadata
  ): Promise<TokenMetadataResponse> {
    try {
      const file = await openAsBlob(METADATA_IMAGE_PATH);
      const formData = new FormData();
      
      formData.append("file", file);
      formData.append("name", metadata.name);
      formData.append("symbol", metadata.symbol);
      formData.append("description", metadata.description);
      formData.append("twitter", metadata.twitter || "");
      formData.append("telegram", metadata.telegram || "");
      formData.append("website", metadata.website || "");
      formData.append("showName", "true");

      setGlobalDispatcher(new Agent({ connect: { timeout: 60_000 } }));
      
      const response = await fetch(METADATA_API_URL, {
        method: "POST",
        headers: METADATA_API_HEADERS,
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Metadata upload failed: ${response.statusText}`);
      }

      const result = await response.json();
      
      
      return result;
    } catch (error) {
      console.error("Error creating token metadata:", error);
      throw error;
    }
  }
}

