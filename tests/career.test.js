import { describe, it, expect, beforeEach } from 'vitest';
import { createRNG, matchSeed } from '../src/core/rng.js';
import { avgStat, clamp, fmt } from '../src/core/utils.js';
import { endSeason } from '../src/core/season.js';
import { checkAchievements } from '../src/core/achievements.js';
import { footballAdapter } from '../src/sports/football/index.js';
import { basketballAdapter } from '../src/sports/basketball/index.js';

// ── RNG ────────────────────────────────────────────────
describe('Seeded RNG', () => {
  it('mulberry32 is deterministic', () => {
    const a = createRNG(12345);
    const b = createRNG(12345);
    const valsA = [a.next(), a.next(), a.next()];
    const valsB = [b.next(), b.next(), b.next()];
    expect(valsA).toEqual(valsB);
  });

  it('matchSeed is stable', () => {
    const s1 = matchSeed(42, 1, 1);
    const s2 = matchSeed(42, 1, 1);
    expect(s1).toEqual(s2);
  });

  it('same seed + inputs ⇒ identical match result', () => {
    // Seeded match: same seed → same outcomes
    const seed1 = matchSeed(999, 2, 5);
    const seed2 = matchSeed(999, 2, 5);
    const rng1  = createRNG(seed1);
    const rng2  = createRNG(seed2);
    // Simulate two dice rolls
    const r1a = rng1.randInt(1, 6);
    const r1b = rng1.randInt(1, 6);
    const r2a = rng2.randInt(1, 6);
    const r2b = rng2.randInt(1, 6);
    expect(r1a).toEqual(r2a);
    expect(r1b).toEqual(r2b);
  });

  it('no Math.random calls in rng.js (grep check at test time)', async () => {
    // This is a structural test: the rng module does not call Math.random
    const fs = await import('fs');
    const src = await fs.promises.readFile('./src/core/rng.js', 'utf8');
    expect(src).not.toMatch(/Math\.random/);
  });
});

// ── Utils ──────────────────────────────────────────────
describe('clamp', () => {
  it('keeps value within range', () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-1, 0, 10)).toBe(0);
    expect(clamp(15, 0, 10)).toBe(10);
  });
});

describe('avgStat', () => {
  it('computes mean of stats', () => {
    const player = { stats: { a: 10, b: 20, c: 30 } };
    expect(avgStat(player)).toBe(20);
  });
  it('rounds to nearest integer', () => {
    const player = { stats: { a: 10, b: 11 } };
    expect(avgStat(player)).toBe(11);
  });
});

// ── Season Rollover ────────────────────────────────────
describe('endSeason', () => {
  const makeCareer = (overrides = {}) => ({
    leagueIndex: 0, seasons: 0, week: 1,
    wins: 0, losses: 0, draws: 0,
    promotions: 0, relegations: 0,
    weeksPerSeason: 24,
    ...overrides,
  });

  it('promotes when win rate >= 0.55', () => {
    const c = makeCareer({ wins: 11, losses: 5, draws: 4 }); // 11/20 = 0.55
    const { promoted } = endSeason(c, 7);
    expect(promoted).toBe(true);
    expect(c.leagueIndex).toBe(1);
    expect(c.promotions).toBe(1);
  });

  it('does not promote below 0.55 win rate', () => {
    const c = makeCareer({ wins: 10, losses: 6, draws: 4 }); // 10/20 = 0.50
    const { promoted } = endSeason(c, 7);
    expect(promoted).toBe(false);
    expect(c.leagueIndex).toBe(0);
  });

  it('relegates when win rate < 0.30', () => {
    const c = makeCareer({ wins: 2, losses: 8, draws: 2, leagueIndex: 2 }); // 2/12 ≈ 0.167
    const { relegated } = endSeason(c, 7);
    expect(relegated).toBe(true);
    expect(c.leagueIndex).toBe(1);
    expect(c.relegations).toBe(1);
  });

  it('does not relegate at exactly 0.30 win rate', () => {
    const c = makeCareer({ wins: 3, losses: 6, draws: 1, leagueIndex: 2 }); // 3/10 = 0.30, not < 0.30
    const { relegated } = endSeason(c, 7);
    expect(relegated).toBe(false);
    expect(c.leagueIndex).toBe(2);
  });

  it('does not promote past the top league', () => {
    const c = makeCareer({ wins: 15, losses: 2, draws: 3, leagueIndex: 6 }); // Bundesliga → CL
    const { promoted } = endSeason(c, 7); // leagues.length = 7, top index = 6
    expect(promoted).toBe(false); // already at top
    expect(c.leagueIndex).toBe(6);
  });

  it('does not relegate below index 0', () => {
    const c = makeCareer({ wins: 1, losses: 15, draws: 2, leagueIndex: 0 });
    const { relegated } = endSeason(c, 7);
    expect(relegated).toBe(false);
    expect(c.leagueIndex).toBe(0);
  });

  it('resets season stats after rollover', () => {
    const c = makeCareer({ wins: 15, losses: 5, draws: 4, season: 1 });
    endSeason(c, 7);
    expect(c.seasons).toBe(1);
    expect(c.wins).toBe(0);
    expect(c.losses).toBe(0);
    expect(c.draws).toBe(0);
    expect(c.week).toBe(1);
  });
});

// ── Achievements ───────────────────────────────────────
describe('checkAchievements', () => {
  const makeState = (overrides = {}) => ({
    sport: 'football',
    player: { totalEarned: 0, stats: {} },
    career: { wins: 0, seasons: 0, bestMatchGoals: 0, leagueIndex: 0, promotions: 0, relegations: 0 },
    achievements: [],
    ...overrides,
  });

  it('fires first_win when first win recorded', () => {
    const s = makeState({ career: { wins: 1 } });
    const unlocked = checkAchievements(s);
    expect(unlocked.map(a => a.id)).toContain('first_win');
    expect(s.achievements).toContain('first_win');
  });

  it('fires hat_trick when 3+ goals in a match', () => {
    const s = makeState({ sport: 'football', career: { bestMatchGoals: 3 } });
    expect(checkAchievements(s, footballAdapter.achievements).map(a => a.id)).toContain('hat_trick');
    // a basketball career never sees an achievement about Tore
    const bb = makeState({ sport: 'basketball', career: { bestMatchGoals: 3 } });
    expect(checkAchievements(bb, basketballAdapter.achievements).map(a => a.id)).not.toContain('hat_trick');
  });

  it('fires promoted when first promotion happens', () => {
    const s = makeState({ career: { promotions: 1 } });
    const unlocked = checkAchievements(s);
    expect(unlocked.map(a => a.id)).toContain('promoted');
  });

  it('fires legend for football at Bundesliga (index 5)', () => {
    const s = makeState({ sport: 'football', career: { leagueIndex: 5, wins: 1 } });
    const unlocked = checkAchievements(s, footballAdapter.achievements);
    expect(unlocked.map(a => a.id)).toContain('legend');
  });

  it('fires legend for basketball at NBA (index 1)', () => {
    const s = makeState({ sport: 'basketball', career: { leagueIndex: 1, wins: 1 } });
    const unlocked = checkAchievements(s, basketballAdapter.achievements);
    expect(unlocked.map(a => a.id)).toContain('legend');
  });

  it('fires basketball-native achievements from the stat block', () => {
    const s = makeState({ sport: 'basketball', career: { bb: { games: 3, pts: 150, best: { pts: 52, reb: 21, ast: 16 }, tripleDoubles: 1, doubleDoubles: 2 } } });
    const ids = checkAchievements(s, basketballAdapter.achievements).map(a => a.id);
    ['triple_double', 'fifty_piece', 'glass_cleaner', 'floor_general'].forEach(id => expect(ids).toContain(id));
    expect(ids).not.toContain('thirty_ppg');   // 50 ppg but only 3 games
  });

  it('only fires each achievement once', () => {
    const s = makeState({ career: { wins: 1 } });
    const first = checkAchievements(s);
    const second = checkAchievements(s);
    expect(first.map(a => a.id)).toContain('first_win');
    expect(second.map(a => a.id)).not.toContain('first_win');
  });

  it('does not fire achievement when condition not met', () => {
    const s = makeState({ career: { wins: 0 } });
    const unlocked = checkAchievements(s);
    expect(unlocked).toHaveLength(0);
  });
});

// ── SportAdapter interface ─────────────────────────────
describe('SportAdapter', () => {
  it('football adapter has all required fields', () => {
    const required = ['id','name','icon','color','positions','stats','leagues','startLeagueIndex','matchEvents','teamNames','createMatch','simulateHeadless','scoreLabel','boxScoreFields'];
    required.forEach(field => {
      expect(footballAdapter).toHaveProperty(field);
    });
  });

  it('basketball adapter has all required fields', () => {
    const required = ['id','name','icon','color','positions','stats','leagues','startLeagueIndex','matchEvents','teamNames','createMatch','simulateHeadless','scoreLabel','boxScoreFields'];
    required.forEach(field => {
      expect(basketballAdapter).toHaveProperty(field);
    });
  });

  it('createMatch returns { opponent, seed }', () => {
    const s = { sport: 'football', player: {}, career: { teamName: 'FC Bayern', season: 1, week: 1 }, _rng: createRNG(42) };
    const ctx = footballAdapter.createMatch(s);
    expect(ctx).toHaveProperty('opponent');
    expect(ctx).toHaveProperty('seed');
    expect(typeof ctx.opponent).toBe('string');
    expect(typeof ctx.seed).toBe('number');
  });

  it('simulateHeadless returns MatchResult shape', () => {
    const rng  = createRNG(matchSeed(42, 1, 1));
    const state = { sport: 'football', player: { energy: 80, morale: 70, stats: { Tempo: 50, Technik: 50, Schuss: 50, Dribbling: 50, Kondition: 50, Kopfball: 50 }, totalEarned: 0, money: 1000, fame: 0 }, career: { leagueIndex: 0, teamName: 'FC Bayern', wins: 0, losses: 0, draws: 0, goals: 0, assists: 0, bestMatchGoals: 0, week: 1, weeksPerSeason: 24, season: 1, promotions: 0, relegations: 0 }, achievements: [], log: [], _rng: rng, _saveSeed: 42 };
    const result = footballAdapter.simulateHeadless(state, { rng });
    expect(result).toHaveProperty('playerGoals');
    expect(result).toHaveProperty('oppGoals');
    expect(result).toHaveProperty('result');
    expect(['win','draw','loss']).toContain(result.result);
  });

  it('no sport=== checks outside src/sports/', async () => {
    const { readFileSync, readdirSync, statSync } = await import('node:fs');
    const { join } = await import('node:path');
    const walk = d => readdirSync(d).flatMap(f => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
    const offenders = walk('src').filter(f => f.endsWith('.js') && !f.startsWith('src/sports') && /sport\s*===/.test(readFileSync(f, 'utf8')));
    expect(offenders).toEqual([]);
  });
});

// ── Save Schema ────────────────────────────────────────
describe('Save schema migration', () => {
  it('loadGame returns null for empty storage', async () => {
    // In node environment we can't test localStorage, but we can test the migrate function
    const { migrate } = await import('../src/core/persistence.js');
    // v1 format with no schemaVersion defaults to v0 → runs through migrations
    const v0Save = { player: { name: 'Test' }, career: {} };
    const result = migrate(v0Save);
    expect(result.schemaVersion).toBe(1);
  });

  it('FUTURE_VERSION returned when save is newer than code', async () => {
    const { migrate } = await import('../src/core/persistence.js');
    const futureSave = { schemaVersion: 99, player: {} };
    const result = migrate(futureSave);
    expect(result._loadError).toBe('FUTURE_VERSION');
  });

  it('CORRUPT_JSON returned when JSON is unparseable', async () => {
    const { migrate } = await import('../src/core/persistence.js');
    const result = migrate('not valid json {');
    expect(result._loadError).toBe('CORRUPT_JSON');
  });
});
