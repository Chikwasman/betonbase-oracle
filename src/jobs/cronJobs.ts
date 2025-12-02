import cron from 'node-cron';
import { MatchScheduler } from '../services/matchScheduler';
import { SettlementService } from '../services/settlementService';
import { Database } from '../services/database';
import { logger } from '../config/logger';

export class CronJobs {
  private matchScheduler: MatchScheduler;
  private settlementService: SettlementService;
  private database: Database;

  constructor() {
    this.matchScheduler = new MatchScheduler();
    this.settlementService = new SettlementService();
    this.database = new Database();
  }

  /**
   * Start all cron jobs
   */
  start(): void {
    logger.info('🚀 Starting cron jobs...');

    // Job 1: Add upcoming matches (every 6 hours)
    this.scheduleMatchAddition();

    // Job 2: Settle finished matches (every 2 hours)
    this.scheduleMatchSettlement();

    // Job 3: Database cleanup (daily at 3 AM)
    this.scheduleDatabaseCleanup();

    // Job 4: Health check (every 30 minutes)
    this.scheduleHealthCheck();

    logger.info('✅ All cron jobs started successfully');
  }

  /**
   * Job 1: Add upcoming matches
   * Runs every 6 hours
   */
  private scheduleMatchAddition(): void {
    // Schedule: 0 */6 * * * (every 6 hours at minute 0)
    cron.schedule('0 */6 * * *', async () => {
      logger.info('\n═══════════════════════════════════════════');
      logger.info('📅 CRON JOB: Add Upcoming Matches');
      logger.info('═══════════════════════════════════════════\n');

      try {
        await this.matchScheduler.processUpcomingMatches();
        
        const stats = this.matchScheduler.getStats();
        logger.info(`\n📊 Current stats: ${JSON.stringify(stats, null, 2)}`);
      } catch (error: any) {
        logger.error(`❌ Error in match addition job: ${error.message}`);
      }

      logger.info('\n═══════════════════════════════════════════\n');
    });

    logger.info('✓ Scheduled: Add upcoming matches (every 6 hours)');
  }

  /**
   * Job 2: Settle finished matches
   * Runs every 2 hours
   */
  private scheduleMatchSettlement(): void {
    // Schedule: 0 */2 * * * (every 2 hours at minute 0)
    cron.schedule('0 */2 * * *', async () => {
      logger.info('\n═══════════════════════════════════════════');
      logger.info('⚽ CRON JOB: Settle Finished Matches');
      logger.info('═══════════════════════════════════════════\n');

      try {
        await this.settlementService.settleFinishedMatches();
        
        const dbStats = this.database.getStats();
        logger.info(`\n📊 Database stats: ${JSON.stringify(dbStats, null, 2)}`);
      } catch (error: any) {
        logger.error(`❌ Error in settlement job: ${error.message}`);
      }

      logger.info('\n═══════════════════════════════════════════\n');
    });

    logger.info('✓ Scheduled: Settle finished matches (every 2 hours)');
  }

  /**
   * Job 3: Database cleanup
   * Runs daily at 3 AM
   */
  private scheduleDatabaseCleanup(): void {
    // Schedule: 0 3 * * * (every day at 3:00 AM)
    cron.schedule('0 3 * * *', async () => {
      logger.info('\n═══════════════════════════════════════════');
      logger.info('🧹 CRON JOB: Database Cleanup');
      logger.info('═══════════════════════════════════════════\n');

      try {
        const removed = this.database.cleanupOldMatches(30);
        logger.info(`✅ Cleanup complete: ${removed} old matches removed`);
      } catch (error: any) {
        logger.error(`❌ Error in cleanup job: ${error.message}`);
      }

      logger.info('\n═══════════════════════════════════════════\n');
    });

    logger.info('✓ Scheduled: Database cleanup (daily at 3:00 AM)');
  }

  /**
   * Job 4: Health check
   * Runs every 30 minutes
   */
  private scheduleHealthCheck(): void {
    // Schedule: */30 * * * * (every 30 minutes)
    cron.schedule('*/30 * * * *', async () => {
      try {
        const stats = this.database.getStats();
        const unsettled = this.database.getUnsettledMatches().length;
        
        logger.info(`\n💚 Health Check: ${stats.total} total matches, ${unsettled} unsettled`);
      } catch (error: any) {
        logger.error(`❌ Health check error: ${error.message}`);
      }
    });

    logger.info('✓ Scheduled: Health check (every 30 minutes)');
  }

  /**
   * Run all jobs immediately (for testing)
   */
  async runAll(): Promise<void> {
    logger.info('\n🔄 Running all jobs immediately...\n');

    // Add matches
    try {
      await this.matchScheduler.processUpcomingMatches();
    } catch (error: any) {
      logger.error(`Error in match addition: ${error.message}`);
    }

    // Settle matches
    try {
      await this.settlementService.settleFinishedMatches();
    } catch (error: any) {
      logger.error(`Error in settlement: ${error.message}`);
    }

    // Cleanup
    try {
      this.database.cleanupOldMatches(30);
    } catch (error: any) {
      logger.error(`Error in cleanup: ${error.message}`);
    }

    logger.info('\n✅ All jobs completed\n');
  }

  /**
   * Run match addition only
   */
  async runMatchAddition(): Promise<void> {
    logger.info('\n📅 Running match addition job...\n');
    await this.matchScheduler.processUpcomingMatches();
  }

  /**
   * Run settlement only
   */
  async runSettlement(): Promise<void> {
    logger.info('\n⚽ Running settlement job...\n');
    await this.settlementService.settleFinishedMatches();
  }
}
