import { BlockchainService } from './services/blockchain';
import { CronJobs } from './jobs/cronJobs';
import { logger } from './config/logger';
import { CONFIG } from './config/constants';

async function main() {
  logger.info('═══════════════════════════════════════════');
  logger.info('🔮 BetOnBase Oracle Service v1.0.0');
  logger.info('═══════════════════════════════════════════\n');

  // Verify configuration
  if (!CONFIG.PRIVATE_KEY) {
    logger.error('❌ PRIVATE_KEY not set in environment variables');
    process.exit(1);
  }

  if (!CONFIG.API_FOOTBALL_KEY) {
    logger.error('❌ API_FOOTBALL_KEY not set in environment variables');
    process.exit(1);
  }

  try {
    // Initialize blockchain service
    logger.info('🔗 Initializing blockchain connection...');
    const blockchain = new BlockchainService();

    // Verify oracle authorization
    logger.info('🔐 Verifying oracle authorization...');
    const isAuthorized = await blockchain.verifyOracle();

    if (!isAuthorized) {
      logger.error('❌ This wallet is not authorized as the oracle!');
      logger.error('Please ensure the correct private key is set in .env');
      process.exit(1);
    }

    // Check wallet balance
    const balance = await blockchain.getBalance();
    logger.info(`💰 Oracle wallet balance: ${balance} ETH`);

    if (parseFloat(balance) < 0.01) {
      logger.warn('⚠️ Low balance! Please fund the oracle wallet for gas fees');
    }

    // Parse command line arguments
    const args = process.argv.slice(2);
    const command = args[0];

    // Initialize cron jobs
    const cronJobs = new CronJobs();

    // Handle different commands
    if (command === 'start') {
      // Start the oracle service with cron jobs
      logger.info('\n🚀 Starting oracle service in production mode...\n');
      cronJobs.start();
      logger.info('✅ Oracle service is running. Press Ctrl+C to stop.\n');
      
      // Keep process alive
      process.on('SIGINT', () => {
        logger.info('\n👋 Shutting down oracle service...');
        process.exit(0);
      });

    } else if (command === 'run-once') {
      // Run all jobs once and exit
      logger.info('\n🔄 Running all jobs once...\n');
      await cronJobs.runAll();
      logger.info('✅ Done! Exiting...\n');
      process.exit(0);

    } else if (command === 'add-matches') {
      // Only add matches
      logger.info('\n📅 Adding upcoming matches...\n');
      await cronJobs.runMatchAddition();
      logger.info('✅ Done! Exiting...\n');
      process.exit(0);

    } else if (command === 'settle-matches') {
      // Only settle matches
      logger.info('\n⚽ Settling finished matches...\n');
      await cronJobs.runSettlement();
      logger.info('✅ Done! Exiting...\n');
      process.exit(0);

    } else if (command === 'help' || !command) {
      // Show help
      logger.info('📖 BetOnBase Oracle Service Commands:\n');
      logger.info('  npm start                - Start oracle service with cron jobs');
      logger.info('  npm run dev              - Run in development mode with auto-reload');
      logger.info('  node dist/index.js start - Start oracle service (production)');
      logger.info('  node dist/index.js run-once       - Run all jobs once and exit');
      logger.info('  node dist/index.js add-matches    - Only add upcoming matches');
      logger.info('  node dist/index.js settle-matches - Only settle finished matches');
      logger.info('  node dist/index.js help           - Show this help message\n');
      process.exit(0);

    } else {
      logger.error(`❌ Unknown command: ${command}`);
      logger.info('Run "node dist/index.js help" for available commands');
      process.exit(1);
    }

  } catch (error: any) {
    logger.error(`❌ Fatal error: ${error.message}`);
    logger.error(error.stack);
    process.exit(1);
  }
}

// Handle uncaught errors
process.on('unhandledRejection', (error: any) => {
  logger.error('❌ Unhandled Promise Rejection:');
  logger.error(error.message);
  logger.error(error.stack);
});

process.on('uncaughtException', (error: any) => {
  logger.error('❌ Uncaught Exception:');
  logger.error(error.message);
  logger.error(error.stack);
  process.exit(1);
});

// Start the service
main();
