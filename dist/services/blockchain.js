"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BlockchainService = void 0;
const ethers_1 = require("ethers");
const constants_1 = require("../config/constants");
const logger_1 = require("../config/logger");
class BlockchainService {
    constructor() {
        // Initialize provider
        this.provider = new ethers_1.ethers.JsonRpcProvider(constants_1.CONFIG.RPC_URL);
        // Initialize wallet
        this.wallet = new ethers_1.ethers.Wallet(constants_1.CONFIG.PRIVATE_KEY, this.provider);
        // Initialize contract
        this.contract = new ethers_1.ethers.Contract(constants_1.CONFIG.BETONBASE_ADDRESS, constants_1.BETONBASE_ABI, this.wallet);
        logger_1.logger.info('Blockchain service initialized');
        logger_1.logger.info(`Oracle wallet: ${this.wallet.address}`);
        logger_1.logger.info(`BetOnBase contract: ${constants_1.CONFIG.BETONBASE_ADDRESS}`);
    }
    /**
     * Verify that the connected wallet is the oracle
     */
    async verifyOracle() {
        try {
            const oracleAddress = await this.contract.oracle();
            const isOracle = oracleAddress.toLowerCase() === this.wallet.address.toLowerCase();
            if (isOracle) {
                logger_1.logger.info(`✅ Oracle verification successful`);
            }
            else {
                logger_1.logger.error(`❌ Oracle verification failed. Expected: ${oracleAddress}, Got: ${this.wallet.address}`);
            }
            return isOracle;
        }
        catch (error) {
            logger_1.logger.error(`Error verifying oracle: ${error.message}`);
            return false;
        }
    }
    /**
     * Add a new match to the blockchain
     */
    async addMatch(apiMatchId, kickoffTime) {
        try {
            logger_1.logger.info(`Adding match ${apiMatchId} with kickoff ${new Date(kickoffTime * 1000).toISOString()}`);
            // Check if match already exists
            const exists = await this.matchExists(apiMatchId);
            if (exists) {
                logger_1.logger.warn(`Match ${apiMatchId} already exists on blockchain`);
                return false;
            }
            const tx = await this.contract.addMatch(apiMatchId, kickoffTime);
            logger_1.logger.info(`Transaction sent: ${tx.hash}`);
            const receipt = await tx.wait();
            logger_1.logger.info(`✅ Match ${apiMatchId} added successfully. Gas used: ${receipt.gasUsed.toString()}`);
            return true;
        }
        catch (error) {
            logger_1.logger.error(`❌ Error adding match ${apiMatchId}: ${error.message}`);
            return false;
        }
    }
    /**
     * Set match result on blockchain
     */
    async setMatchResult(apiMatchId, result) {
        try {
            logger_1.logger.info(`Setting result for match ${apiMatchId}: ${constants_1.MatchResult[result]}`);
            const tx = await this.contract.setMatchResult(apiMatchId, result);
            logger_1.logger.info(`Transaction sent: ${tx.hash}`);
            const receipt = await tx.wait();
            logger_1.logger.info(`✅ Match ${apiMatchId} result set successfully. Gas used: ${receipt.gasUsed.toString()}`);
            return true;
        }
        catch (error) {
            logger_1.logger.error(`❌ Error setting result for match ${apiMatchId}: ${error.message}`);
            return false;
        }
    }
    /**
     * Cancel a match (postponed/abandoned)
     */
    async cancelMatch(apiMatchId) {
        try {
            logger_1.logger.info(`Cancelling match ${apiMatchId}`);
            const tx = await this.contract.cancelMatch(apiMatchId);
            logger_1.logger.info(`Transaction sent: ${tx.hash}`);
            const receipt = await tx.wait();
            logger_1.logger.info(`✅ Match ${apiMatchId} cancelled successfully. Gas used: ${receipt.gasUsed.toString()}`);
            return true;
        }
        catch (error) {
            logger_1.logger.error(`❌ Error cancelling match ${apiMatchId}: ${error.message}`);
            return false;
        }
    }
    /**
     * Get match data from blockchain
     */
    async getMatch(apiMatchId) {
        try {
            const match = await this.contract.matches(apiMatchId);
            return {
                apiMatchId: match[0],
                kickoffTime: match[1],
                bettingClosed: match[2],
                result: Number(match[3]),
                settled: match[4],
            };
        }
        catch (error) {
            logger_1.logger.error(`Error fetching match ${apiMatchId} from blockchain: ${error.message}`);
            return null;
        }
    }
    /**
     * Check if match exists on blockchain
     */
    async matchExists(apiMatchId) {
        try {
            const match = await this.getMatch(apiMatchId);
            // A match exists if kickoffTime is not 0
            return match !== null && match.kickoffTime > 0n;
        }
        catch (error) {
            logger_1.logger.error(`Error checking if match exists: ${error.message}`);
            return false;
        }
    }
    /**
     * Get current block timestamp
     */
    async getCurrentBlockTimestamp() {
        try {
            const block = await this.provider.getBlock('latest');
            return block ? block.timestamp : Math.floor(Date.now() / 1000);
        }
        catch (error) {
            logger_1.logger.error(`Error getting block timestamp: ${error.message}`);
            return Math.floor(Date.now() / 1000);
        }
    }
    /**
     * Get wallet balance
     */
    async getBalance() {
        try {
            const balance = await this.provider.getBalance(this.wallet.address);
            return ethers_1.ethers.formatEther(balance);
        }
        catch (error) {
            logger_1.logger.error(`Error getting balance: ${error.message}`);
            return '0';
        }
    }
}
exports.BlockchainService = BlockchainService;
