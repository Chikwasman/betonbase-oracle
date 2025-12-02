import fs from 'fs';
import path from 'path';
import { logger } from '../config/logger';

export interface StoredMatch {
  apiMatchId: number;
  homeTeam: string;
  awayTeam: string;
  kickoffTime: number;
  league: number;
  leagueName: string;
  status: 'scheduled' | 'added' | 'settled' | 'cancelled' | 'error';
  result?: number;
  addedAt?: number;
  settledAt?: number;
  error?: string;
}

export interface DatabaseSchema {
  matches: Record<number, StoredMatch>; // apiMatchId => match
  lastUpdate: number;
  version: string;
}

export class Database {
  private filePath: string;
  private data: DatabaseSchema;

  constructor() {
    // Ensure data directory exists
    const dataDir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    this.filePath = path.join(dataDir, 'matches.json');
    this.data = this.load();
  }

  /**
   * Load database from file
   */
  private load(): DatabaseSchema {
    try {
      if (fs.existsSync(this.filePath)) {
        const content = fs.readFileSync(this.filePath, 'utf-8');
        const data = JSON.parse(content);
        logger.info(`Database loaded: ${Object.keys(data.matches).length} matches`);
        return data;
      }
    } catch (error: any) {
      logger.error(`Error loading database: ${error.message}`);
    }

    // Return empty database
    logger.info('Initializing new database');
    return {
      matches: {},
      lastUpdate: Date.now(),
      version: '1.0.0',
    };
  }

  /**
   * Save database to file
   */
  private save(): void {
    try {
      this.data.lastUpdate = Date.now();
      const content = JSON.stringify(this.data, null, 2);
      fs.writeFileSync(this.filePath, content, 'utf-8');
      logger.debug('Database saved successfully');
    } catch (error: any) {
      logger.error(`Error saving database: ${error.message}`);
    }
  }

  /**
   * Save or update a match
   */
  saveMatch(match: StoredMatch): void {
    this.data.matches[match.apiMatchId] = match;
    this.save();
    logger.debug(`Match ${match.apiMatchId} saved to database`);
  }

  /**
   * Get a match by ID
   */
  getMatch(apiMatchId: number): StoredMatch | null {
    return this.data.matches[apiMatchId] || null;
  }

  /**
   * Update match fields
   */
  updateMatch(apiMatchId: number, updates: Partial<StoredMatch>): void {
    const existing = this.data.matches[apiMatchId];
    if (existing) {
      this.data.matches[apiMatchId] = { ...existing, ...updates };
      this.save();
      logger.debug(`Match ${apiMatchId} updated in database`);
    } else {
      logger.warn(`Attempted to update non-existent match ${apiMatchId}`);
    }
  }

  /**
   * Get all matches
   */
  getAllMatches(): StoredMatch[] {
    return Object.values(this.data.matches);
  }

  /**
   * Get matches by status
   */
  getMatchesByStatus(status: StoredMatch['status']): StoredMatch[] {
    return this.getAllMatches().filter(m => m.status === status);
  }

  /**
   * Get matches by league
   */
  getMatchesByLeague(leagueId: number): StoredMatch[] {
    return this.getAllMatches().filter(m => m.league === leagueId);
  }

  /**
   * Get unsettled matches (added but not settled)
   */
  getUnsettledMatches(): StoredMatch[] {
    const now = Date.now() / 1000;
    return this.getAllMatches().filter(
      m => m.status === 'added' && m.kickoffTime < now
    );
  }

  /**
   * Delete a match
   */
  deleteMatch(apiMatchId: number): void {
    delete this.data.matches[apiMatchId];
    this.save();
    logger.debug(`Match ${apiMatchId} deleted from database`);
  }

  /**
   * Clear all matches
   */
  clearAll(): void {
    this.data.matches = {};
    this.save();
    logger.warn('All matches cleared from database');
  }

  /**
   * Get database statistics
   */
  getStats(): {
    total: number;
    byStatus: Record<string, number>;
    byLeague: Record<string, number>;
    oldestMatch: number | null;
    newestMatch: number | null;
  } {
    const matches = this.getAllMatches();
    
    const byStatus: Record<string, number> = {};
    const byLeague: Record<string, number> = {};
    let oldestMatch: number | null = null;
    let newestMatch: number | null = null;

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
  cleanupOldMatches(daysOld: number = 30): number {
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
      logger.info(`Cleaned up ${removed} old matches`);
    }

    return removed;
  }
}
