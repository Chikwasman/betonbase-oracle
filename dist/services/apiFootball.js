"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApiFootballService = void 0;
const axios_1 = __importDefault(require("axios"));
const constants_1 = require("../config/constants");
const logger_1 = require("../config/logger");
class ApiFootballService {
    constructor() {
        this.baseUrl = constants_1.CONFIG.API_FOOTBALL_BASE_URL;
        this.apiKey = constants_1.CONFIG.API_FOOTBALL_KEY;
    }
    /**
     * Get upcoming fixtures for a specific league
     */
    async getUpcomingFixtures(leagueId, daysAhead = 4) {
        try {
            const today = new Date();
            const futureDate = new Date(today.getTime() + daysAhead * 24 * 60 * 60 * 1000);
            const fromDate = today.toISOString().split('T')[0];
            const toDate = futureDate.toISOString().split('T')[0];
            logger_1.logger.info(`Fetching fixtures for league ${leagueId} from ${fromDate} to ${toDate}`);
            const response = await axios_1.default.get(`${this.baseUrl}/fixtures`, {
                headers: {
                    'x-rapidapi-key': this.apiKey,
                    'x-rapidapi-host': 'v3.football.api-sports.io',
                },
                params: {
                    league: leagueId,
                    season: new Date().getFullYear(),
                    from: fromDate,
                    to: toDate,
                    status: 'NS', // Not Started
                },
            });
            const fixtures = response.data.response || [];
            logger_1.logger.info(`Found ${fixtures.length} upcoming fixtures for league ${leagueId}`);
            return fixtures;
        }
        catch (error) {
            logger_1.logger.error(`Error fetching fixtures for league ${leagueId}: ${error.message}`);
            return [];
        }
    }
    /**
     * Get finished fixtures for result settlement
     */
    async getFinishedFixtures(leagueId) {
        try {
            const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
            const dateStr = yesterday.toISOString().split('T')[0];
            logger_1.logger.info(`Fetching finished fixtures for league ${leagueId} on ${dateStr}`);
            const response = await axios_1.default.get(`${this.baseUrl}/fixtures`, {
                headers: {
                    'x-rapidapi-key': this.apiKey,
                    'x-rapidapi-host': 'v3.football.api-sports.io',
                },
                params: {
                    league: leagueId,
                    season: new Date().getFullYear(),
                    date: dateStr,
                    status: 'FT', // Full Time
                },
            });
            const fixtures = response.data.response || [];
            logger_1.logger.info(`Found ${fixtures.length} finished fixtures for league ${leagueId}`);
            return fixtures;
        }
        catch (error) {
            logger_1.logger.error(`Error fetching finished fixtures for league ${leagueId}: ${error.message}`);
            return [];
        }
    }
    /**
     * Get fixture by ID
     */
    async getFixtureById(fixtureId) {
        try {
            const response = await axios_1.default.get(`${this.baseUrl}/fixtures`, {
                headers: {
                    'x-rapidapi-key': this.apiKey,
                    'x-rapidapi-host': 'v3.football.api-sports.io',
                },
                params: {
                    id: fixtureId,
                },
            });
            const fixtures = response.data.response || [];
            return fixtures[0] || null;
        }
        catch (error) {
            logger_1.logger.error(`Error fetching fixture ${fixtureId}: ${error.message}`);
            return null;
        }
    }
    /**
     * Determine match result from goals
     */
    getMatchResult(homeGoals, awayGoals) {
        if (homeGoals === null || awayGoals === null)
            return 0; // PENDING
        if (homeGoals > awayGoals)
            return 1; // HOME_WIN
        if (awayGoals > homeGoals)
            return 2; // AWAY_WIN
        return 3; // DRAW
    }
}
exports.ApiFootballService = ApiFootballService;
