import { ApiFootballService } from './apiFootball';
import { BlockchainService } from './blockchain';
import { Database } from './database';
import { CONFIG, LEAGUE_NAMES } from '../config/constants';
import { logger } from '../config/logger';

export interface ScheduledMatch {
  apiMatchId: number;
  homeTeam: string;
  awayTeam: string;
  kickoffTime: number;
  league: number;
  leagueName: string;
  status: 'scheduled' | 'added' | 'error';
  addedAt?: number;
  error?: string;
}

export class MatchScheduler {
  private apiFootball: ApiFootballService;
  private blockchain: BlockchainService;
  private database: Database;

  constructor() {
    this.apiFootball = new ApiFootballService();
    this.blockchain = new BlockchainService();
    this.database = new Database();
  }

  /**
   * Main function to fetch and add upcoming matches from all leagues
   */
  async processUpcomingMatches(): Promise<void> {
    logger.info('🔄 Starting match scheduling process...');

    const leagues = Object.values(CONFIG.LEAGUES);
    let totalFound = 0;
    let totalAdded = 0;
    let totalSkipped = 0;
    let totalErrors = 0;

    for (const leagueId of leagues) {
      const leagueName = LEAGUE_NAMES[leagueId] || `League ${leagueId}`;
      logger.info(`\n📊 Processing ${leagueName} (ID: ${leagueId})`);

      try {
        // Fetch upcoming fixtures from API-Football
        const fixtures = await this.apiFootball.getUpcomingFixtures(
          leagueId,
          CONFIG.MATCH_ADD_DAYS_BEFORE
        );

        totalFound += fixtures.length;

        if (fixtures.length === 0) {
          logger.info(`No upcoming matches found for ${leagueName}`);
          continue;
        }

        // Process each fixture
        for (const fixture of fixtures) {
          const result = await this.processFixture(fixture, leagueId, leagueName);
          
          if (result === 'added') totalAdded++;
          else if (result === 'skipped') totalSkipped++;
          else if (result === 'error') totalErrors++;
        }

        // Small delay between leagues to avoid rate limiting
        await this.delay(1000);
      } catch (error: any) {
        logger.error(`Error processing league ${leagueName}: ${error.message}`);
        totalErrors++;
      }
    }

    logger.info(`\n✅ Match scheduling complete!`);
    logger.info(`📊 Summary: Found=${totalFound}, Added=${totalAdded}, Skipped=${totalSkipped}, Errors=${totalErrors}`);
  }

  /**
   * Process a single fixture
   */
  private async processFixture(
    fixture: any,
    leagueId: number,
    leagueName: string
  ): Promise<'added' | 'skipped' | 'error'> {
    const apiMatchId = fixture.fixture.id;
    const kickoffTime = fixture.fixture.timestamp;
    const homeTeam = fixture.teams.home.name;
    const awayTeam = fixture.teams.away.name;

    try {
      // Check if match is already in database
      const existingMatch = this.database.getMatch(apiMatchId);
      if (existingMatch && existingMatch.status === 'added') {
        logger.debug(`Match ${apiMatchId} already added: ${homeTeam} vs ${awayTeam}`);
        return 'skipped';
      }

      // Check if match exists on blockchain
      const onChain = await this.blockchain.matchExists(apiMatchId);
      if (onChain) {
        logger.info(`Match ${apiMatchId} already on blockchain: ${homeTeam} vs ${awayTeam}`);
        
        // Update database status
        this.database.updateMatch(apiMatchId, { status: 'added', addedAt: Date.now() });
        return 'skipped';
      }

      // Add match to blockchain
      logger.info(`➕ Adding match: ${homeTeam} vs ${awayTeam} (${new Date(kickoffTime * 1000).toISOString()})`);
      
      const success = await this.blockchain.addMatch(apiMatchId, kickoffTime);
      
      if (success) {
        // Save to database
        const match: ScheduledMatch = {
          apiMatchId,
          homeTeam,
          awayTeam,
          kickoffTime,
          league: leagueId,
          leagueName,
          status: 'added',
          addedAt: Date.now(),
        };
        
        this.database.saveMatch(match);
        logger.info(`✅ Successfully added match ${apiMatchId}`);
        return 'added';
      } else {
        logger.error(`❌ Failed to add match ${apiMatchId}`);
        
        // Save error to database
        this.database.saveMatch({
          apiMatchId,
          homeTeam,
          awayTeam,
          kickoffTime,
          league: leagueId,
          leagueName,
          status: 'error',
          error: 'Blockchain transaction failed',
        });
        
        return 'error';
      }
    } catch (error: any) {
      logger.error(`Error processing fixture ${apiMatchId}: ${error.message}`);
      
      // Save error to database
      this.database.saveMatch({
        apiMatchId,
        homeTeam,
        awayTeam,
        kickoffTime,
        league: leagueId,
        leagueName,
        status: 'error',
        error: error.message,
      });
      
      return 'error';
    }
  }

  /**
   * Check for matches that are exactly 4 days away from now
   */
  async checkMatchesForToday(): Promise<void> {
    logger.info('🔍 Checking for matches to add today...');

    const targetTimestamp = Date.now() + (CONFIG.MATCH_ADD_DAYS_BEFORE * 24 * 60 * 60 * 1000);
    const targetDate = new Date(targetTimestamp);
    
    logger.info(`Target date: ${targetDate.toISOString()}`);

    await this.processUpcomingMatches();
  }

  /**
   * Utility function to add delay
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get statistics from database
   */
  getStats(): { total: number; added: number; scheduled: number; errors: number } {
    const matches = this.database.getAllMatches();
    
    return {
      total: matches.length,
      added: matches.filter(m => m.status === 'added').length,
      scheduled: matches.filter(m => m.status === 'scheduled').length,
      errors: matches.filter(m => m.status === 'error').length,
    };
  }
}
