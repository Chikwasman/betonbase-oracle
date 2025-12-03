"use strict";
// FILE: betonbase-oracle/src/api-server.ts
// Standalone API server to serve matches to frontend
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const database_1 = require("./services/database");
const constants_1 = require("./config/constants");
const logger_1 = require("./config/logger");
const app = (0, express_1.default)();
const PORT = process.env.API_PORT || 3001;
// Enable CORS for frontend
app.use((0, cors_1.default)({
    origin: process.env.FRONTEND_URL || '*', // Set your frontend URL
    credentials: true,
}));
app.use(express_1.default.json());
// Initialize database
const db = new database_1.Database();
/**
 * GET /api/matches
 * Returns all upcoming matches
 */
app.get('/api/matches', (req, res) => {
    try {
        const now = Math.floor(Date.now() / 1000);
        const matches = db.getAllMatches()
            .filter(m => m.status === 'added')
            .filter(m => m.kickoffTime > now)
            .map(m => ({
            id: m.apiMatchId,
            league: m.leagueName || constants_1.LEAGUE_NAMES[m.league] || 'Unknown',
            homeTeam: m.homeTeam,
            awayTeam: m.awayTeam,
            kickoffTime: m.kickoffTime,
            bettingClosed: m.kickoffTime - now <= 900, // 15 min before
        }))
            .sort((a, b) => a.kickoffTime - b.kickoffTime);
        logger_1.logger.info(`API: Served ${matches.length} matches`);
        res.json({ success: true, matches, count: matches.length });
    }
    catch (error) {
        logger_1.logger.error(`API Error: ${error.message}`);
        res.status(500).json({ success: false, error: 'Failed to fetch matches' });
    }
});
/**
 * GET /api/matches/:id
 * Returns a specific match by ID
 */
app.get('/api/matches/:id', (req, res) => {
    try {
        const matchId = parseInt(req.params.id);
        const match = db.getMatch(matchId);
        if (!match) {
            return res.status(404).json({ success: false, error: 'Match not found' });
        }
        const now = Math.floor(Date.now() / 1000);
        res.json({
            success: true,
            match: {
                id: match.apiMatchId,
                league: match.leagueName || constants_1.LEAGUE_NAMES[match.league],
                homeTeam: match.homeTeam,
                awayTeam: match.awayTeam,
                kickoffTime: match.kickoffTime,
                status: match.status,
                result: match.result,
                bettingClosed: match.kickoffTime - now <= 900,
            }
        });
    }
    catch (error) {
        logger_1.logger.error(`API Error: ${error.message}`);
        res.status(500).json({ success: false, error: 'Failed to fetch match' });
    }
});
/**
 * GET /api/health
 * Health check endpoint
 */
app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        status: 'ok',
        timestamp: Date.now(),
        service: 'betonbase-oracle-api'
    });
});
// Start server
const server = app.listen(PORT, () => {
    logger_1.logger.info('═══════════════════════════════════════════');
    logger_1.logger.info('🚀 BetOnBase API Server');
    logger_1.logger.info('═══════════════════════════════════════════');
    logger_1.logger.info(`📡 API Server running on port ${PORT}`);
    logger_1.logger.info(`🌐 CORS enabled for: ${process.env.FRONTEND_URL || 'all origins'}`);
    logger_1.logger.info('\n📡 Available Endpoints:');
    logger_1.logger.info(`   GET /api/matches - All upcoming matches`);
    logger_1.logger.info(`   GET /api/matches/:id - Specific match`);
    logger_1.logger.info(`   GET /api/health - Health check`);
    logger_1.logger.info('═══════════════════════════════════════════\n');
});
// Graceful shutdown
process.on('SIGTERM', () => {
    logger_1.logger.info('SIGTERM signal received: closing HTTP server');
    server.close(() => {
        logger_1.logger.info('HTTP server closed');
    });
});
exports.default = app;
