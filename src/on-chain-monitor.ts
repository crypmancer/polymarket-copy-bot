/**
 * On-chain event monitoring for Polymarket trades
 * Queries Polygon blockchain for trade events from specific wallets
 */
import { ethers } from 'ethers';

// Polymarket ConditionalTokens contract address on Polygon
// This is the main contract that handles market positions
const CONDITIONAL_TOKENS_ADDRESS = '0x4D97DCd97eC945f40cF65F87097ACe5EA0476045';

// ABI for ConditionalTokens contract - OrderFilled event
const CONDITIONAL_TOKENS_ABI = [
  'event OrderFilled(bytes32 indexed orderHash, address indexed maker, address indexed taker, uint256 makerTokenId, uint256 takerTokenId, uint256 makerAmount, uint256 takerAmount)',
  'event PositionSplit(address indexed account, address indexed collateralToken, uint256 parentCollectionId, uint256 conditionId, uint256[] partition, uint256 amount)'
];

export interface OnChainTrade {
  txHash: string;
  blockNumber: number;
  timestamp: Date;
  walletAddress: string;
  marketId?: string;
  outcome?: string;
  side?: 'buy' | 'sell';
  price?: number;
  size?: number;
  rawData: any;
}

export class OnChainMonitor {
  private provider: ethers.JsonRpcProvider;
  private conditionalTokensContract: ethers.Contract;
  private walletAddresses: string[];

  constructor(rpcUrl: string, walletAddresses: string[]) {
    this.provider = new ethers.JsonRpcProvider(rpcUrl);
    this.conditionalTokensContract = new ethers.Contract(
      CONDITIONAL_TOKENS_ADDRESS,
      CONDITIONAL_TOKENS_ABI,
      this.provider
    );
    this.walletAddresses = walletAddresses.map(addr => addr.toLowerCase());
  }

  /**
   * Get trades for a specific wallet from on-chain events
   */
  async getWalletTrades(
    walletAddress: string,
    since?: Date,
    limit: number = 100
  ): Promise<OnChainTrade[]> {
    try {
      const trades: OnChainTrade[] = [];
      const walletLower = walletAddress.toLowerCase();

      // Get current block number
      const currentBlock = await this.provider.getBlockNumber();
      
      // Use smaller default range to avoid "block range too large" errors
      // Most RPC providers limit to ~2000 blocks per query
      const maxBlockRange = 1000; // Safe default for most RPC providers
      
      let sinceBlock = since
        ? await this.getBlockNumberForTimestamp(since)
        : currentBlock - maxBlockRange; // Default: last ~2000 blocks (~1 hour)

      // Ensure we don't query too many blocks at once
      if (currentBlock - sinceBlock > maxBlockRange) {
        sinceBlock = currentBlock - maxBlockRange;
      }

      // Query OrderFilled events where wallet is maker or taker
      const orderFilledFilter = this.conditionalTokensContract.filters.OrderFilled();
      
      // Split large queries into smaller chunks
      const allEvents: ethers.EventLog[] = [];
      let fromBlock = sinceBlock;
      const chunkSize = maxBlockRange;

      while (fromBlock < currentBlock && trades.length < limit) {
        const toBlock = Math.min(fromBlock + chunkSize, currentBlock);
        
        try {
          // Get events from the contract for this chunk
          const events = await this.conditionalTokensContract.queryFilter(
            orderFilledFilter,
            fromBlock,
            toBlock
          );
          
          // Filter for EventLog type
          for (const event of events) {
            if ('args' in event && event.args) {
              allEvents.push(event as ethers.EventLog);
            }
          }
          
          fromBlock = toBlock + 1;
          
          // Small delay to avoid rate limiting
          if (fromBlock < currentBlock) {
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        } catch (error: any) {
          // If chunk still too large, try even smaller chunks
          if (error.error?.code === -32062 || error.message?.includes('too large')) {
            console.warn(`Block range still too large, trying smaller chunks...`);
            const smallerChunk = Math.floor(chunkSize / 2);
            if (smallerChunk < 100) {
              console.error('Block range too small, skipping this query');
              break;
            }
            // Retry with smaller chunk (will be handled in next iteration)
            fromBlock = fromBlock + smallerChunk;
            continue;
          }
          throw error;
        }
      }

      // Process events
      const events = allEvents;

      for (const event of events) {
        // Check if event is EventLog (has args) and not just Log
        if (!('args' in event) || !event.args) continue;

        const eventLog = event as ethers.EventLog;
        const maker = (eventLog.args.maker as string).toLowerCase();
        const taker = (eventLog.args.taker as string).toLowerCase();

        // Check if wallet is involved in this trade
        if (maker === walletLower || taker === walletLower) {
          const block = await this.provider.getBlock(eventLog.blockNumber);
          
          if (!block) {
            console.warn(`Block ${eventLog.blockNumber} not found`);
            continue;
          }
          
          const trade: OnChainTrade = {
            txHash: eventLog.transactionHash,
            blockNumber: eventLog.blockNumber,
            timestamp: new Date(block.timestamp * 1000),
            walletAddress: walletAddress,
            rawData: {
              maker,
              taker,
              makerTokenId: eventLog.args.makerTokenId.toString(),
              takerTokenId: eventLog.args.takerTokenId.toString(),
              makerAmount: eventLog.args.makerAmount.toString(),
              takerAmount: eventLog.args.takerAmount.toString()
            }
          };

          trades.push(trade);

          if (trades.length >= limit) {
            break;
          }
        }
      }

      // Sort by timestamp (newest first)
      trades.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

      return trades;
    } catch (error) {
      console.error(`Error fetching on-chain trades for ${walletAddress}:`, error);
      return [];
    }
  }

  /**
   * Get block number for a given timestamp (approximate)
   */
  private async getBlockNumberForTimestamp(timestamp: Date): Promise<number> {
    try {
      const currentBlock = await this.provider.getBlockNumber();
      const currentBlockData = await this.provider.getBlock(currentBlock);
      
      if (!currentBlockData) {
        throw new Error('Could not fetch current block data');
      }
      
      const currentTimestamp = currentBlockData.timestamp;

      const targetTimestamp = Math.floor(timestamp.getTime() / 1000);
      const timeDiff = currentTimestamp - targetTimestamp;

      // Polygon block time is approximately 2 seconds
      const blockTime = 2;
      const blocksAgo = Math.floor(timeDiff / blockTime);

      // Limit to reasonable range to avoid "block range too large" errors
      const maxBlocksAgo = 2000; // ~1 hour of blocks
      const calculatedBlocksAgo = Math.min(blocksAgo, maxBlocksAgo);

      return Math.max(0, currentBlock - calculatedBlocksAgo);
    } catch (error) {
      console.error('Error getting block number for timestamp:', error);
      // Return a safe default (last 1000 blocks, ~30 minutes)
      const currentBlock = await this.provider.getBlockNumber();
      return Math.max(0, currentBlock - 1000);
    }
  }

  /**
   * Monitor for new trades in real-time using event filters
   */
  startMonitoring(
    callback: (trade: OnChainTrade) => void,
    checkInterval: number = 5000
  ): () => void {
    let isRunning = true;
    let lastCheckedBlock = 0;

    const monitor = async () => {
      if (!isRunning) return;

      try {
        const currentBlock = await this.provider.getBlockNumber();
        const fromBlock = lastCheckedBlock || currentBlock - 10;

        for (const walletAddress of this.walletAddresses) {
          const trades = await this.getWalletTrades(walletAddress);
          
          for (const trade of trades) {
            if (trade.blockNumber > fromBlock) {
              callback(trade);
            }
          }
        }

        lastCheckedBlock = currentBlock;
      } catch (error) {
        console.error('Error in on-chain monitoring:', error);
      }

      if (isRunning) {
        setTimeout(monitor, checkInterval);
      }
    };

    monitor();

    // Return stop function
    return () => {
      isRunning = false;
    };
  }
}

