import axios from 'axios';
import { CONFIG } from '../config/constants';
import { logger } from '../config/logger';

export interface Fixture {
  fixture: {
    id: number;
    timestamp: number;
    status: {
      short: string; // 'NS', 'FT', 'PST', etc.
    };
  };
  league: {
    id: number;
    name: string;
  };
  teams: {
    home: {
      name: string;
    };
    away: {
      name: string;
    };
  };
  goals: {
    home: number | null;
    away: number | null;
  };
}

export class ApiFootballService {
  private baseUrl: string;
  private apiKey: string;

  constructor() {
    this.baseUrl = CONFIG.API_FOOTBALL_BASE_URL;
    this.apiKey = CONFIG.API_FOOTBALL_KEY;
  }

  /**
   * Get upcoming fixtures for a specific league
   */
  async getUpcomingFixtures(leagueId: number, daysAhead: number = 4): Promise<Fixture[]> {
    try {
      const today = new Date();
      const futureDate = new Date(today.getTime() + daysAhead * 24 * 60 * 60 * 1000);
      
      const fromDate = today.toISOString().split('T')[0];
      const toDate = futureDate.toISOString().split('T')[0];

      logger.info(`Fetching fixtures for league ${leagueId} from ${fromDate} to ${toDate}`);

      const response = await axios.get(`${this.baseUrl}/fixtures`, {
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
      logger.info(`Found ${fixtures.length} upcoming fixtures for league ${leagueId}`);
      
      return fixtures;
    } catch (error: any) {
      logger.error(`Error fetching fixtures for league ${leagueId}: ${error.message}`);
      return [];
    }
  }

  /**
   * Get finished fixtures for result settlement
   */
  async getFinishedFixtures(leagueId: number): Promise<Fixture[]> {
    try {
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const dateStr = yesterday.toISOString().split('T')[0];

      logger.info(`Fetching finished fixtures for league ${leagueId} on ${dateStr}`);

      const response = await axios.get(`${this.baseUrl}/fixtures`, {
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
      logger.info(`Found ${fixtures.length} finished fixtures for league ${leagueId}`);
      
      return fixtures;
    } catch (error: any) {
      logger.error(`Error fetching finished fixtures for league ${leagueId}: ${error.message}`);
      return [];
    }
  }

  /**
   * Get fixture by ID
   */
  async getFixtureById(fixtureId: number): Promise<Fixture | null> {
    try {
      const response = await axios.get(`${this.baseUrl}/fixtures`, {
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
    } catch (error: any) {
      logger.error(`Error fetching fixture ${fixtureId}: ${error.message}`);
      return null;
    }
  }

  /**
   * Determine match result from goals
   */
  getMatchResult(homeGoals: number | null, awayGoals: number | null): number {
    if (homeGoals === null || awayGoals === null) return 0; // PENDING

    if (homeGoals > awayGoals) return 1; // HOME_WIN
    if (awayGoals > homeGoals) return 2; // AWAY_WIN
    return 3; // DRAW
  }
}