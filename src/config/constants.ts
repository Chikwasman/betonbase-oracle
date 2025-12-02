import dotenv from 'dotenv';

dotenv.config();

export const CONFIG = {
  // Blockchain
  PRIVATE_KEY: process.env.PRIVATE_KEY || '',
  RPC_URL: process.env.BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org',
  BETONBASE_ADDRESS: process.env.BETONBASE_ADDRESS || '0xF75dD9a3101040B99FA61708CF1A8038Cce048b5',
  
  // API-Football
  API_FOOTBALL_KEY: process.env.API_FOOTBALL_KEY || '',
  API_FOOTBALL_BASE_URL: process.env.API_FOOTBALL_BASE_URL || 'https://v3.football.api-sports.io',
  
  // Leagues
  LEAGUES: {
    EPL: parseInt(process.env.LEAGUE_EPL || '39'),
    LA_LIGA: parseInt(process.env.LEAGUE_LA_LIGA || '140'),
    SERIE_A: parseInt(process.env.LEAGUE_SERIE_A || '135'),
    BUNDESLIGA: parseInt(process.env.LEAGUE_BUNDESLIGA || '78'),
    CHAMPIONS: parseInt(process.env.LEAGUE_CHAMPIONS || '2'),
    EUROPA: parseInt(process.env.LEAGUE_EUROPA || '3'),
  },
  
  // Timing
  MATCH_ADD_DAYS_BEFORE: parseInt(process.env.MATCH_ADD_DAYS_BEFORE || '4'),
  CHECK_INTERVAL_HOURS: parseInt(process.env.CHECK_INTERVAL_HOURS || '6'),
};

export const BETONBASE_ABI = [
  'function addMatch(uint256 apiMatchId, uint256 kickoffTime)',
  'function setMatchResult(uint256 apiMatchId, uint8 result)',
  'function cancelMatch(uint256 apiMatchId)',
  'function matches(uint256) view returns (uint256 apiMatchId, uint256 kickoffTime, bool bettingClosed, uint8 result, bool settled)',
  'function oracle() view returns (address)',
];

export enum MatchResult {
  PENDING = 0,
  HOME_WIN = 1,
  AWAY_WIN = 2,
  DRAW = 3,
  CANCELLED = 4,
}

export const LEAGUE_NAMES: Record<number, string> = {
  39: 'Premier League',
  140: 'La Liga',
  135: 'Serie A',
  78: 'Bundesliga',
  2: 'Champions League',
  3: 'Europa League',
};