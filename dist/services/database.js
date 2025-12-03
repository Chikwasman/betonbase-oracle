"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Database = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const logger_1 = require("../config/logger");
class Database {
    constructor() {
        // Ensure data directory exists
        const dataDir = path_1.default.join(process.cwd(), 'data');
        if (!fs_1.default.existsSync(dataDir)) {
            fs_1.default.mkdirSync(dataDir, { recursive: true });
        }
        this.filePath = path_1.default.join(dataDir, 'matches.json');
        this.data = this.load();
    }
    /**
     * Load database from file
     */
    load() {
        try {
            if (fs_1.default.existsSync(this.filePath)) {
                const content = fs_1.default.readFileSync(this.filePath, 'utf-8');
                const data = JSON.parse(content);
                logger_1.logger.info(`Database loaded: ${Object.keys(data.matches).length} matches`);
                return data;
            }
        }
        catch (error) {
            logger_1.logger.error(`Error loading database: ${error.message}`);
        }
        // Return empty database
        logger_1.logger.info('Initializing new database');
        return {
            matches: {},
            lastUpdate: Date.now(),
            version: '1.0.0',
        };
    }
    /**
     * Save database to file
     */
    save() {
        try {
            this.data.lastUpdate = Date.now();
            const content = JSON.stringify(this.data, null, 2);
            fs_1.default.writeFileSync(this.filePath, content, 'utf-8');
            logger_1.logger.debug('Database saved successfully');
        }
        catch (error) {
            logger_1.logger.error(`Error saving database: ${error.message}`);
        }
    }
    /**
     * Save or update a match
     */
    saveMatch(match) {
        this.data.matches[match.apiMatchId] = match;
        this.save();
        logger_1.logger.debug(`Match ${match.apiMatchId} saved to database`);
    }
    /**
     * Get a match by ID
     */
    getMatch(apiMatchId) {
        return this.data.matches[apiMatchId] || null;
    }
    /**
     * Update match fields
     */
    updateMatch(apiMatchId, updates) {
        const existing = this.data.matches[apiMatchId];
        if (existing) {
            this.data.matches[apiMatchId] = { ...existing, ...updates };
            this.save();
            logger_1.logger.debug(`Match ${apiMatchId} updated in database`);
        }
        else {
            logger_1.logger.warn(`Attempted to update non-existent match ${apiMatchId}`);
        }
    }
    /**
     * Get all matches
     */
    getAllMatches() {
        return Object.values(this.data.matches);
    }
    /**
     * Get matches by status
     */
    getMatchesByStatus(status) {
        return this.getAllMatches().filter(m => m.status === status);
    }
    /**
     * Get matches by league
     */
    getMatchesByLeague(leagueId) {
        return this.getAllMatches().filter(m => m.league === leagueId);
    }
    /**
     * Get unsettled matches (added but not settled)
     */
    getUnsettledMatches() {
        const now = Date.now() / 1000;
        return this.getAllMatches().filter(m => m.status === 'added' && m.kickoffTime < now);
    }
    /**
     * Delete a match
     */
    deleteMatch(apiMatchId) {
        delete this.data.matches[apiMatchId];
        this.save();
        logger_1.logger.debug(`Match ${apiMatchId} deleted from database`);
    }
    /**
     * Clear all matches
     */
    clearAll() {
        this.data.matches = {};
        this.save();
        logger_1.logger.warn('All matches cleared from database');
    }
    /**
     * Get database statistics
     */
    getStats() {
        const matches = this.getAllMatches();
        const byStatus = {};
        const byLeague = {};
        let oldestMatch = null;
        let newestMatch = null;
        matches.forEach(match => {
            // Count by status
            byStatus[match.status] = (byStatus[match.status] || 0) + 1;
            // Count by league
            const leagueName = match.leagueName || `League ${match.league}`;
            byLeague[leagueName] = (byLeague[leagueName] || 0) + 1;
            // Track oldest/newest
            if (!oldestMatch || match.kickoffTime < oldestMatch) {
                oldestMatch = match.kickoffTime;
            }
            if (!newestMatch || match.kickoffTime > newestMatch) {
                newestMatch = match.kickoffTime;
            }
        });
        return {
            total: matches.length,
            byStatus,
            byLeague,
            oldestMatch,
            newestMatch,
        };
    }
    /**
     * Clean up old matches (older than 30 days)
     */
    cleanupOldMatches(daysOld = 30) {
        const cutoffTime = (Date.now() / 1000) - (daysOld * 24 * 60 * 60);
        const matches = this.getAllMatches();
        let removed = 0;
        matches.forEach(match => {
            if (match.kickoffTime < cutoffTime && (match.status === 'settled' || match.status === 'cancelled')) {
                this.deleteMatch(match.apiMatchId);
                removed++;
            }
        });
        if (removed > 0) {
            logger_1.logger.info(`Cleaned up ${removed} old matches`);
        }
        return removed;
    }
}
exports.Database = Database;
