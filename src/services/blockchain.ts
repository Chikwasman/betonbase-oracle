import { ethers } from 'ethers';
import { CONFIG, BETONBASE_ABI, MatchResult } from '../config/constants';
import { logger } from '../config/logger';

export interface OnChainMatch {
  apiMatchId: bigint;
  kickoffTime: bigint;
  bettingClosed: boolean;
  result: number;
  settled: boolean;
}

export class BlockchainService {
  private provider: ethers.JsonRpcProvider;
  private wallet: ethers.Wallet;
  private contract: ethers.Contract;

  constructor() {
    // Initialize provider
    this.provider = new ethers.JsonRpcProvider(CONFIG.RPC_URL);
    
    // Initialize wallet
    this.wallet = new ethers.Wallet(CONFIG.PRIVATE_KEY, this.provider);
    
    // Initialize contract
    this.contract = new ethers.Contract(
      CONFIG.BETONBASE_ADDRESS,
      BETONBASE_ABI,
      this.wallet
    );

    logger.info('Blockchain service initialized');
    logger.info(`Oracle wallet: ${this.wallet.address}`);
    logger.info(`BetOnBase contract: ${CONFIG.BETONBASE_ADDRESS}`);
  }

  /**
   * Verify that the connected wallet is the oracle
   */
  async verifyOracle(): Promise<boolean> {
    try {
      const oracleAddress = await this.contract.oracle();
      const isOracle = oracleAddress.toLowerCase() === this.wallet.address.toLowerCase();
      
      if (isOracle) {
        logger.info(`✅ Oracle verification successful`);
      } else {
        logger.error(`❌ Oracle verification failed. Expected: ${oracleAddress}, Got: ${this.wallet.address}`);
      }
      
      return isOracle;
    } catch (error: any) {
      logger.error(`Error verifying oracle: ${error.message}`);
      return false;
    }
  }

  /**
   * Add a new match to the blockchain
   */
  async addMatch(apiMatchId: number, kickoffTime: number): Promise<boolean> {
    try {
      logger.info(`Adding match ${apiMatchId} with kickoff ${new Date(kickoffTime * 1000).toISOString()}`);
      
      // Check if match already exists
      const exists = await this.matchExists(apiMatchId);
      if (exists) {
        logger.warn(`Match ${apiMatchId} already exists on blockchain`);
        return false;
      }

      const tx = await this.contract.addMatch(apiMatchId, kickoffTime);
      logger.info(`Transaction sent: ${tx.hash}`);
      
      const receipt = await tx.wait();
      logger.info(`✅ Match ${apiMatchId} added successfully. Gas used: ${receipt.gasUsed.toString()}`);
      
      return true;
    } catch (error: any) {
      logger.error(`❌ Error adding match ${apiMatchId}: ${error.message}`);
      return false;
    }
  }

  /**
   * Set match result on blockchain
   */
  async setMatchResult(apiMatchId: number, result: MatchResult): Promise<boolean> {
    try {
      logger.info(`Setting result for match ${apiMatchId}: ${MatchResult[result]}`);
      
      const tx = await this.contract.setMatchResult(apiMatchId, result);
      logger.info(`Transaction sent: ${tx.hash}`);
      
      const receipt = await tx.wait();
      logger.info(`✅ Match ${apiMatchId} result set successfully. Gas used: ${receipt.gasUsed.toString()}`);
      
      return true;
    } catch (error: any) {
      logger.error(`❌ Error setting result for match ${apiMatchId}: ${error.message}`);
      return false;
    }
  }

  /**
   * Cancel a match (postponed/abandoned)
   */
  async cancelMatch(apiMatchId: number): Promise<boolean> {
    try {
      logger.info(`Cancelling match ${apiMatchId}`);
      
      const tx = await this.contract.cancelMatch(apiMatchId);
      logger.info(`Transaction sent: ${tx.hash}`);
      
      const receipt = await tx.wait();
      logger.info(`✅ Match ${apiMatchId} cancelled successfully. Gas used: ${receipt.gasUsed.toString()}`);
      
      return true;
    } catch (error: any) {
      logger.error(`❌ Error cancelling match ${apiMatchId}: ${error.message}`);
      return false;
    }
  }

  /**
   * Get match data from blockchain
   */
  async getMatch(apiMatchId: number): Promise<OnChainMatch | null> {
    try {
      const match = await this.contract.matches(apiMatchId);
      
      return {
        apiMatchId: match[0],
        kickoffTime: match[1],
        bettingClosed: match[2],
        result: Number(match[3]),
        settled: match[4],
      };
    } catch (error: any) {
      logger.error(`Error fetching match ${apiMatchId} from blockchain: ${error.message}`);
      return null;
    }
  }

  /**
   * Check if match exists on blockchain
   */
  async matchExists(apiMatchId: number): Promise<boolean> {
    try {
      const match = await this.getMatch(apiMatchId);
      // A match exists if kickoffTime is not 0
      return match !== null && match.kickoffTime > 0n;
    } catch (error: any) {
      logger.error(`Error checking if match exists: ${error.message}`);
      return false;
    }
  }

  /**
   * Get current block timestamp
   */
  async getCurrentBlockTimestamp(): Promise<number> {
    try {
      const block = await this.provider.getBlock('latest');
      return block ? block.timestamp : Math.floor(Date.now() / 1000);
    } catch (error: any) {
      logger.error(`Error getting block timestamp: ${error.message}`);
      return Math.floor(Date.now() / 1000);
    }
  }

  /**
   * Get wallet balance
   */
  async getBalance(): Promise<string> {
    try {
      const balance = await this.provider.getBalance(this.wallet.address);
      return ethers.formatEther(balance);
    } catch (error: any) {
      logger.error(`Error getting balance: ${error.message}`);
      return '0';
    }
  }
}
