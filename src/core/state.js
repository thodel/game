// ── State factory ─────────────────────────────────────
// Creates a fresh game state. No side-effects, no DOM.

import { pickOne } from './utils.js';

/**
 * @param {string} sport - 'football' | 'basketball'
 * @param {string} playerName
 * @param {string} position
 * @param {object} adapter - the sport adapter for this sport
 * @param {object} rng - RNG instance (used for rand calls)
 */
export function newState(sport, playerName, position, adapter, rng) {
  const isBasketball = sport === 'basketball';

  // Generate base stats using the seeded RNG
  const baseStats = {};
  adapter.stats.forEach(s => {
    baseStats[s] = isBasketball ? rng.randInt(45, 65) : rng.randInt(20, 40);
  });

  const startLeague = adapter.startLeagueIndex ?? 0;
  let startTeams;
  if (isBasketball && adapter.teamsByLeague) {
    startTeams = adapter.teamsByLeague[startLeague];
  } else {
    startTeams = adapter.teamNames;
  }

  return {
    sport,
    player: {
      name: playerName,
      position,
      age: isBasketball ? rng.randInt(19, 22) : 17,
      energy: 100,
      morale: 75,
      fame: isBasketball ? rng.randInt(20, 40) : 0,
      money: isBasketball ? rng.randInt(500000, 2000000) : 500,
      totalEarned: 0,
      stats: baseStats,
      skillPoints: isBasketball ? 2 : 3,
    },
    career: {
      leagueIndex: startLeague,
      teamName: pickOne(rng, startTeams),
      season: 1,
      seasons: 0,
      week: 1,
      weeksPerSeason: 24,
      wins: 0,
      losses: 0,
      draws: 0,
      goals: 0,      // personal goals/points
      assists: 0,
      promotions: 0,
      relegations: 0,
      bestMatchGoals: 0,
    },
    achievements: [],
    log: [],
    seasonLog: [],
    schemaVersion: 1,
  };
}
