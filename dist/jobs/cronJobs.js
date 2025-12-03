"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CronJobs = void 0;
const node_cron_1 = __importDefault(require("node-cron"));
const matchScheduler_1 = require("../services/matchScheduler");
const settlementService_1 = require("../services/settlementService");
const database_1 = require("../services/database");
const logger_1 = require("../config/logger");
class CronJobs {
    constructor() {
        this.matchScheduler = new matchScheduler_1.MatchScheduler();
        this.settlementService = new settlementService_1.SettlementService();
        this.database = new database_1.Database();
    }
    /**
     * Start all cron jobs
     */
    start() {
        logger_1.logger.info('🚀 Starting cron jobs...');
        // Job 1: Add upcoming matches (every 6 hours)
        this.scheduleMatchAddition();
        // Job 2: Settle finished matches (every 2 hours)
        this.scheduleMatchSettlement();
        // Job 3: Database cleanup (daily at 3 AM)
        this.scheduleDatabaseCleanup();
        // Job 4: Health check (every 30 minutes)
        this.scheduleHealthCheck();
        logger_1.logger.info('✅ All cron jobs started successfully');
    }
    /**
     * Job 1: Add upcoming matches
     * Runs every 6 hours
     */
    scheduleMatchAddition() {
        // Schedule: 0 */6 * * * (every 6 hours at minute 0)
        node_cron_1.default.schedule('0 */6 * * *', async () => {
            logger_1.logger.info('\n═══════════════════════════════════════════');
            logger_1.logger.info('📅 CRON JOB: Add Upcoming Matches');
            logger_1.logger.info('═══════════════════════════════════════════\n');
            try {
                await this.matchScheduler.processUpcomingMatches();
                const stats = this.matchScheduler.getStats();
                logger_1.logger.info(`\n📊 Current stats: ${JSON.stringify(stats, null, 2)}`);
            }
            catch (error) {
                logger_1.logger.error(`❌ Error in match addition job: ${error.message}`);
            }
            logger_1.logger.info('\n═══════════════════════════════════════════\n');
        });
        logger_1.logger.info('✓ Scheduled: Add upcoming matches (every 6 hours)');
    }
    /**
     * Job 2: Settle finished matches
     * Runs every 2 hours
     */
    scheduleMatchSettlement() {
        // Schedule: 0 */2 * * * (every 2 hours at minute 0)
        node_cron_1.default.schedule('0 */2 * * *', async () => {
            logger_1.logger.info('\n═══════════════════════════════════════════');
            logger_1.logger.info('⚽ CRON JOB: Settle Finished Matches');
            logger_1.logger.info('═══════════════════════════════════════════\n');
            try {
                await this.settlementService.settleFinishedMatches();
                const dbStats = this.database.getStats();
                logger_1.logger.info(`\n📊 Database stats: ${JSON.stringify(dbStats, null, 2)}`);
            }
            catch (error) {
                logger_1.logger.error(`❌ Error in settlement job: ${error.message}`);
            }
            logger_1.logger.info('\n═══════════════════════════════════════════\n');
        });
        logger_1.logger.info('✓ Scheduled: Settle finished matches (every 2 hours)');
    }
    /**
     * Job 3: Database cleanup
     * Runs daily at 3 AM
     */
    scheduleDatabaseCleanup() {
        // Schedule: 0 3 * * * (every day at 3:00 AM)
        node_cron_1.default.schedule('0 3 * * *', async () => {
            logger_1.logger.info('\n═══════════════════════════════════════════');
            logger_1.logger.info('🧹 CRON JOB: Database Cleanup');
            logger_1.logger.info('═══════════════════════════════════════════\n');
            try {
                const removed = this.database.cleanupOldMatches(30);
                logger_1.logger.info(`✅ Cleanup complete: ${removed} old matches removed`);
            }
            catch (error) {
                logger_1.logger.error(`❌ Error in cleanup job: ${error.message}`);
            }
            logger_1.logger.info('\n═══════════════════════════════════════════\n');
        });
        logger_1.logger.info('✓ Scheduled: Database cleanup (daily at 3:00 AM)');
    }
    /**
     * Job 4: Health check
     * Runs every 30 minutes
     */
    scheduleHealthCheck() {
        // Schedule: */30 * * * * (every 30 minutes)
        node_cron_1.default.schedule('*/30 * * * *', async () => {
            try {
                const stats = this.database.getStats();
                const unsettled = this.database.getUnsettledMatches().length;
                logger_1.logger.info(`\n💚 Health Check: ${stats.total} total matches, ${unsettled} unsettled`);
            }
            catch (error) {
                logger_1.logger.error(`❌ Health check error: ${error.message}`);
            }
        });
        logger_1.logger.info('✓ Scheduled: Health check (every 30 minutes)');
    }
    /**
     * Run all jobs immediately (for testing)
     */
    async runAll() {
        logger_1.logger.info('\n🔄 Running all jobs immediately...\n');
        // Add matches
        try {
            await this.matchScheduler.processUpcomingMatches();
        }
        catch (error) {
            logger_1.logger.error(`Error in match addition: ${error.message}`);
        }
        // Settle matches
        try {
            await this.settlementService.settleFinishedMatches();
        }
        catch (error) {
            logger_1.logger.error(`Error in settlement: ${error.message}`);
        }
        // Cleanup
        try {
            this.database.cleanupOldMatches(30);
        }
        catch (error) {
            logger_1.logger.error(`Error in cleanup: ${error.message}`);
        }
        logger_1.logger.info('\n✅ All jobs completed\n');
    }
    /**
     * Run match addition only
     */
    async runMatchAddition() {
        logger_1.logger.info('\n📅 Running match addition job...\n');
        await this.matchScheduler.processUpcomingMatches();
    }
    /**
     * Run settlement only
     */
    async runSettlement() {
        logger_1.logger.info('\n⚽ Running settlement job...\n');
        await this.settlementService.settleFinishedMatches();
    }
}
exports.CronJobs = CronJobs;
