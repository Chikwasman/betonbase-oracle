"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const blockchain_1 = require("./services/blockchain");
const cronJobs_1 = require("./jobs/cronJobs");
const logger_1 = require("./config/logger");
const constants_1 = require("./config/constants");
async function main() {
    logger_1.logger.info('═══════════════════════════════════════════');
    logger_1.logger.info('🔮 BetOnBase Oracle Service v1.0.0');
    logger_1.logger.info('═══════════════════════════════════════════\n');
    // Verify configuration
    if (!constants_1.CONFIG.PRIVATE_KEY) {
        logger_1.logger.error('❌ PRIVATE_KEY not set in environment variables');
        process.exit(1);
    }
    if (!constants_1.CONFIG.API_FOOTBALL_KEY) {
        logger_1.logger.error('❌ API_FOOTBALL_KEY not set in environment variables');
        process.exit(1);
    }
    try {
        // Initialize blockchain service
        logger_1.logger.info('🔗 Initializing blockchain connection...');
        const blockchain = new blockchain_1.BlockchainService();
        // Verify oracle authorization
        logger_1.logger.info('🔐 Verifying oracle authorization...');
        const isAuthorized = await blockchain.verifyOracle();
        if (!isAuthorized) {
            logger_1.logger.error('❌ This wallet is not authorized as the oracle!');
            logger_1.logger.error('Please ensure the correct private key is set in .env');
            process.exit(1);
        }
        // Check wallet balance
        const balance = await blockchain.getBalance();
        logger_1.logger.info(`💰 Oracle wallet balance: ${balance} ETH`);
        if (parseFloat(balance) < 0.01) {
            logger_1.logger.warn('⚠️ Low balance! Please fund the oracle wallet for gas fees');
        }
        // Parse command line arguments
        const args = process.argv.slice(2);
        const command = args[0];
        // Initialize cron jobs
        const cronJobs = new cronJobs_1.CronJobs();
        // Handle different commands
        if (command === 'start') {
            // Start the oracle service with cron jobs
            logger_1.logger.info('\n🚀 Starting oracle service in production mode...\n');
            cronJobs.start();
            logger_1.logger.info('✅ Oracle service is running. Press Ctrl+C to stop.\n');
            // Keep process alive
            process.on('SIGINT', () => {
                logger_1.logger.info('\n👋 Shutting down oracle service...');
                process.exit(0);
            });
        }
        else if (command === 'run-once') {
            // Run all jobs once and exit
            logger_1.logger.info('\n🔄 Running all jobs once...\n');
            await cronJobs.runAll();
            logger_1.logger.info('✅ Done! Exiting...\n');
            process.exit(0);
        }
        else if (command === 'add-matches') {
            // Only add matches
            logger_1.logger.info('\n📅 Adding upcoming matches...\n');
            await cronJobs.runMatchAddition();
            logger_1.logger.info('✅ Done! Exiting...\n');
            process.exit(0);
        }
        else if (command === 'settle-matches') {
            // Only settle matches
            logger_1.logger.info('\n⚽ Settling finished matches...\n');
            await cronJobs.runSettlement();
            logger_1.logger.info('✅ Done! Exiting...\n');
            process.exit(0);
        }
        else if (command === 'help' || !command) {
            // Show help
            logger_1.logger.info('📖 BetOnBase Oracle Service Commands:\n');
            logger_1.logger.info('  npm start                - Start oracle service with cron jobs');
            logger_1.logger.info('  npm run dev              - Run in development mode with auto-reload');
            logger_1.logger.info('  node dist/index.js start - Start oracle service (production)');
            logger_1.logger.info('  node dist/index.js run-once       - Run all jobs once and exit');
            logger_1.logger.info('  node dist/index.js add-matches    - Only add upcoming matches');
            logger_1.logger.info('  node dist/index.js settle-matches - Only settle finished matches');
            logger_1.logger.info('  node dist/index.js help           - Show this help message\n');
            process.exit(0);
        }
        else {
            logger_1.logger.error(`❌ Unknown command: ${command}`);
            logger_1.logger.info('Run "node dist/index.js help" for available commands');
            process.exit(1);
        }
    }
    catch (error) {
        logger_1.logger.error(`❌ Fatal error: ${error.message}`);
        logger_1.logger.error(error.stack);
        process.exit(1);
    }
}
// Handle uncaught errors
process.on('unhandledRejection', (error) => {
    logger_1.logger.error('❌ Unhandled Promise Rejection:');
    logger_1.logger.error(error.message);
    logger_1.logger.error(error.stack);
});
process.on('uncaughtException', (error) => {
    logger_1.logger.error('❌ Uncaught Exception:');
    logger_1.logger.error(error.message);
    logger_1.logger.error(error.stack);
    process.exit(1);
});
// Start the service
main();
