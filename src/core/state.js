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
  // Everything that differs between sports comes from the adapter
  const st = adapter.starting || { statRange: [20, 40], age: [17, 17], fame: [0, 0], money: [500, 500], skillPoints: 3 };
  const baseStats = {};
  adapter.stats.forEach(s => { baseStats[s] = rng.randInt(st.statRange[0], st.statRange[1]); });

  const startLeague = adapter.startLeagueIndex ?? 0;
  const startTeams = adapter.teamPool ? adapter.teamPool(startLeague) : adapter.teamNames;

  return {
    sport,
    player: {
      name: playerName,
      position,
      age: rng.randInt(st.age[0], st.age[1]),
      energy: 100,
      morale: 75,
      fame: rng.randInt(st.fame[0], st.fame[1]),
      money: rng.randInt(st.money[0], st.money[1]),
      totalEarned: 0,
      stats: baseStats,
      skillPoints: st.skillPoints,
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
      lastMatchWeek: 0, // for back-to-back detection (Epic #49)
    },
    league: {
      teams: {},    // teamName → { roster, w, l, pts } (Epic #51)
      season: 1,
    },
    achievements: [],
    log: [],
    seasonLog: [],
    schemaVersion: 1,
  };
}
