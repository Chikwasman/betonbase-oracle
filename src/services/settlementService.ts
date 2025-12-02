import { ApiFootballService } from './apiFootball';
import { BlockchainService } from './blockchain';
import { Database } from './database';
import { CONFIG, MatchResult, LEAGUE_NAMES } from '../config/constants';
import { logger } from '../config/logger';

export class SettlementService {
  private apiFootball: ApiFootballService;
  private blockchain: BlockchainService;
  private database: Database;

  constructor() {
    this.apiFootball = new ApiFootballService();
    this.blockchain = new BlockchainService();
    this.database = new Database();
  }

  /**
   * Main function to settle finished matches
   */
  async settleFinishedMatches(): Promise<void> {
    logger.info('⚽ Starting match settlement process...');

    // Get unsettled matches from database (matches past kickoff time)
    const unsettledMatches = this.database.getUnsettledMatches();

    if (unsettledMatches.length === 0) {
      logger.info('No unsettled matches found');
      return;
    }

    logger.info(`Found ${unsettledMatches.length} unsettled matches`);

    let totalSettled = 0;
    let totalPending = 0;
    let totalCancelled = 0;
    let totalErrors = 0;

    // Process each unsettled match
    for (const match of unsettledMatches) {
      const result = await this.settleMatch(match.apiMatchId);
      
      if (result === 'settled') totalSettled++;
      else if (result === 'pending') totalPending++;
      else if (result === 'cancelled') totalCancelled++;
      else if (result === 'error') totalErrors++;

      // Small delay between settlements to avoid rate limiting
      await this.delay(500);
    }

    logger.info(`\n✅ Settlement complete!`);
    logger.info(`📊 Summary: Settled=${totalSettled}, Pending=${totalPending}, Cancelled=${totalCancelled}, Errors=${totalErrors}`);
  }

  /**
   * Settle a single match
   */
  private async settleMatch(apiMatchId: number): Promise<'settled' | 'pending' | 'cancelled' | 'error'> {
    const dbMatch = this.database.getMatch(apiMatchId);
    if (!dbMatch) {
      logger.error(`Match ${apiMatchId} not found in database`);
      return 'error';
    }

    try {
      logger.info(`\n🔍 Checking match ${apiMatchId}: ${dbMatch.homeTeam} vs ${dbMatch.awayTeam}`);

      // Fetch latest fixture data from API-Football
      const fixture = await this.apiFootball.getFixtureById(apiMatchId);

      if (!fixture) {
        logger.error(`Could not fetch fixture ${apiMatchId} from API-Football`);
        return 'error';
      }

      const status = fixture.fixture.status.short;
      logger.info(`Match status: ${status}`);

      // Handle different match statuses
      if (status === 'FT') {
        // Match finished - settle it
        return await this.processFinishedMatch(fixture, dbMatch);
      } else if (status === 'PST' || status === 'CANC' || status === 'ABD' || status === 'AWD') {
        // Match postponed, cancelled, abandoned, or awarded
        return await this.processCancelledMatch(apiMatchId, dbMatch, status);
      } else if (status === 'NS' || status === 'LIVE' || status === '1H' || status === '2H' || status === 'HT') {
        // Match not started or still in progress
        logger.info(`Match ${apiMatchId} is ${status}, waiting for completion`);
        return 'pending';
      } else {
        logger.warn(`Unknown match status: ${status} for match ${apiMatchId}`);
        return 'pending';
      }
    } catch (error: any) {
      logger.error(`Error settling match ${apiMatchId}: ${error.message}`);
      return 'error';
    }
  }

  /**
   * Process a finished match
   */
  private async processFinishedMatch(fixture: any, dbMatch: any): Promise<'settled' | 'error'> {
    const apiMatchId = fixture.fixture.id;
    const homeGoals = fixture.goals.home;
    const awayGoals = fixture.goals.away;

    logger.info(`Final score: ${dbMatch.homeTeam} ${homeGoals} - ${awayGoals} ${dbMatch.awayTeam}`);

    // Determine result
    const matchResult = this.apiFootball.getMatchResult(homeGoals, awayGoals);
    const resultName = MatchResult[matchResult];

    logger.info(`Match result: ${resultName}`);

    // Set result on blockchain
    const success = await this.blockchain.setMatchResult(apiMatchId, matchResult);

    if (success) {
      // Update database
      this.database.updateMatch(apiMatchId, {
        status: 'settled',
        result: matchResult,
        settledAt: Date.now(),
      });

      logger.info(`✅ Match ${apiMatchId} settled successfully with result: ${resultName}`);
      return 'settled';
    } else {
      logger.error(`❌ Failed to settle match ${apiMatchId} on blockchain`);
      return 'error';
    }
  }

  /**
   * Process a cancelled/postponed match
   */
  private async processCancelledMatch(
    apiMatchId: number,
    dbMatch: any,
    status: string
  ): Promise<'cancelled' | 'error'> {
    logger.warn(`Match ${apiMatchId} is ${status} - cancelling on blockchain`);

    // Cancel on blockchain
    const success = await this.blockchain.cancelMatch(apiMatchId);

    if (success) {
      // Update database
      this.database.updateMatch(apiMatchId, {
        status: 'cancelled',
        result: MatchResult.CANCELLED,
        settledAt: Date.now(),
        error: `Match ${status}`,
      });

      logger.info(`✅ Match ${apiMatchId} cancelled successfully`);
      return 'cancelled';
    } else {
      logger.error(`❌ Failed to cancel match ${apiMatchId} on blockchain`);
      return 'error';
    }
  }

  /**
   * Settle all matches from the last 24 hours
   */
  async settleLast24Hours(): Promise<void> {
    logger.info('🔄 Settling matches from last 24 hours...');

    const leagues = Object.values(CONFIG.LEAGUES);

    for (const leagueId of leagues) {
      const leagueName = LEAGUE_NAMES[leagueId] || `League ${leagueId}`;
      logger.info(`\n📊 Processing ${leagueName} (ID: ${leagueId})`);

      try {
        // Get finished fixtures from API-Football
        const fixtures = await this.apiFootball.getFinishedFixtures(leagueId);

        if (fixtures.length === 0) {
          logger.info(`No finished matches for ${leagueName}`);
          continue;
        }

        logger.info(`Found ${fixtures.length} finished matches`);

        // Process each finished fixture
        for (const fixture of fixtures) {
          const apiMatchId = fixture.fixture.id;
          
          // Check if match is in our database
          const dbMatch = this.database.getMatch(apiMatchId);
          if (!dbMatch) {
            logger.debug(`Match ${apiMatchId} not in database, skipping`);
            continue;
          }

          // Check if already settled
          if (dbMatch.status === 'settled' || dbMatch.status === 'cancelled') {
            logger.debug(`Match ${apiMatchId} already settled`);
            continue;
          }

          // Settle the match
          await this.processFinishedMatch(fixture, dbMatch);
          await this.delay(500);
        }
      } catch (error: any) {
        logger.error(`Error processing league ${leagueName}: ${error.message}`);
      }

      // Delay between leagues
      await this.delay(1000);
    }
  }

  /**
   * Force settle a specific match (admin function)
   */
  async forceSettle(apiMatchId: number, result: MatchResult): Promise<boolean> {
    logger.warn(`⚠️ Force settling match ${apiMatchId} with result ${MatchResult[result]}`);

    const success = await this.blockchain.setMatchResult(apiMatchId, result);

    if (success) {
      this.database.updateMatch(apiMatchId, {
        status: 'settled',
        result,
        settledAt: Date.now(),
      });
      return true;
    }

    return false;
  }

  /**
   * Utility function to add delay
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
