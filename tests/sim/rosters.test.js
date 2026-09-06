// #51 persistent rosters and #52 tendencies, archetypes and stars — in the
// live engine and in the season totals behind the leaderboards.
import { describe, it, expect } from 'vitest';
import { playBasketballGame } from './harness.js';
import { basketballAdapter, initLeagueRoster, makeRoster, ensureHumanSlot, applyBoxToRoster, getLeagueLeaders, settleLeagueBoxes } from '../../src/sports/basketball/index.js';
import { createRNG } from '../../src/core/rng.js';
import { newState } from '../../src/core/state.js';
import { SeasonEngine } from '../../src/sports/basketball/season.js';

function freshState(seed = 7) {
  const rng = createRNG(seed);
  const state = newState('basketball', 'Test Spieler', 'Small Forward', basketballAdapter, rng);
  state._rng = rng; state._saveSeed = seed;
  initLeagueRoster(state, basketballAdapter, rng);
  return state;
}

const sum = (rows, k) => rows.reduce((a, r) => a + (r[k] || 0), 0);

describe('persistent rosters in the live engine (#51)', () => {
  it('the same opponent played twice fields the same men, and the human takes his slot', async () => {
    const rng = createRNG(3);
    const home = makeRoster(rng, 72), away = makeRoster(rng, 70);
    const g1 = await playBasketballGame({ quarterMinutes: 2, seed: 61, homeRoster: home, awayRoster: away });
    const g2 = await playBasketballGame({ quarterMinutes: 2, seed: 62, homeRoster: home, awayRoster: away });
    const names = g => g.box.away.map(r => r.name).sort();
    expect(names(g1)).toEqual(names(g2));
    expect(names(g1)).toEqual(away.map(pl => pl.name).sort());
    // the home side is the roster with the human standing in for the small forward
    const homeNames = g1.box.home.map(r => r.name);
    expect(homeNames).toContain('Test Player');
    expect(homeNames.filter(n => home.some(pl => pl.name === n))).toHaveLength(9);
    expect(g1.box.home).toHaveLength(10);
  }, 120000);

  it('season totals equal the box scores that produced them, for every club', () => {
    const state = freshState();
    ensureHumanSlot(state);
    const opponent = basketballAdapter.teamsByLeague[state.career.leagueIndex].find(n => n !== state.career.teamName);
    const totals = {};
    for (const seed of [11, 12, 13]) {
      const sim = basketballAdapter.simulateGame(state, { rng: createRNG(seed), opponent, isHome: true });
      [...sim.boxScore, ...sim.oppBox].forEach(r => { totals[r.name] = (totals[r.name] || 0) + r.pts; });
    }
    const league = state.league.teams;
    [...league[state.career.teamName].roster, ...league[opponent].roster].filter(pl => !pl.human).forEach(pl => {
      expect(pl.stats.pts).toBe(totals[pl.name] || 0);
      if (totals[pl.name] !== undefined) expect(pl.stats.gp).toBe(3);
    });
    const me = league[state.career.teamName].roster.find(pl => pl.human);
    expect(me.name).toBe('Test Spieler');
    expect(me.stats.gp).toBe(3);
  });

  it('a live box score lands in the roster too, the human on his own slot', () => {
    const rng = createRNG(5);
    const roster = makeRoster(rng, 60);
    roster[2].human = true; roster[2].name = 'Ich';
    applyBoxToRoster(roster, [
      { name: roster[0].name, pts: 20, reb: 4, ast: 3, min: 30 },
      { human: true, name: 'Ich', pts: 31, reb: 7, ast: 9, min: 36 },
      { name: 'Nobody Known', pts: 99, reb: 9, ast: 9, min: 10 },
    ]);
    expect(roster[0].stats).toMatchObject({ pts: 20, reb: 4, ast: 3, gp: 1 });
    expect(roster[2].stats).toMatchObject({ pts: 31, reb: 7, ast: 9, gp: 1 });
    expect(sum(roster, 'gp')).toBe(0);   // gp lives under stats, nothing else was touched
  });

  it('every club in the league accumulates numbers that match its results', () => {
    const state = freshState(12);
    ensureHumanSlot(state);
    const pool = basketballAdapter.teamsByLeague[state.career.leagueIndex];
    const season = state.career.nba = SeasonEngine.createSeason(pool, state.career.teamName, createRNG(777));
    SeasonEngine.advanceTo(season, 30);
    settleLeagueBoxes(state);
    const settled = season.games.filter(g => g.boxed && g.home !== season.myTeam && g.away !== season.myTeam);
    expect(settled.length).toBeGreaterThan(5);
    const expectedPts = {}, expectedGp = {};
    settled.forEach(g => {
      expectedPts[g.home] = (expectedPts[g.home] || 0) + g.hs; expectedGp[g.home] = (expectedGp[g.home] || 0) + 1;
      expectedPts[g.away] = (expectedPts[g.away] || 0) + g.as; expectedGp[g.away] = (expectedGp[g.away] || 0) + 1;
    });
    Object.entries(expectedPts).forEach(([id, pts]) => {
      const roster = state.league.teams[season.teams[id].name].roster;
      expect(sum(roster.map(pl => pl.stats), 'pts')).toBe(pts);
      roster.forEach(pl => expect(pl.stats.gp).toBe(expectedGp[id]));
    });
    const { scorers } = getLeagueLeaders(state);
    expect(scorers.length).toBe(5);
    expect(Number(scorers[0].avg)).toBeLessThan(45);
  });

  it('league leaders are per-game and plausible after a stretch of games', () => {
    const state = freshState(9);
    ensureHumanSlot(state);
    const pool = basketballAdapter.teamsByLeague[state.career.leagueIndex].filter(n => n !== state.career.teamName);
    let seed = 100;
    pool.slice(0, 6).forEach(opponent => {
      for (let k = 0; k < 2; k++) basketballAdapter.simulateGame(state, { rng: createRNG(seed++), opponent, isHome: k === 0 });
    });
    const { scorers, rebounders, assisters, efficiency } = getLeagueLeaders(state);
    expect(scorers).toHaveLength(5);
    expect(Number(scorers[0].avg)).toBeGreaterThan(10);
    expect(Number(scorers[0].avg)).toBeLessThan(45);
    expect(Number(scorers[0].avg)).toBeGreaterThanOrEqual(Number(scorers[4].avg));
    expect(rebounders[0].stats.gp).toBeGreaterThan(0);
    expect(assisters[0].stats.gp).toBeGreaterThan(0);
    expect(efficiency).toHaveLength(5);
  });
});

describe('tendencies, archetypes and stars (#52)', () => {
  it('two clubs of equal strength play visibly differently: shooters shoot threes, slashers drive', async () => {
    const rng = createRNG(21);
    const shooters = makeRoster(rng, 72).map(pl => ({ ...pl, star: false, tendency: { archetype: 'shooter', threeRate: 0.7, driveRate: 0.15, passFirst: 0.3 } }));
    const slashers = makeRoster(rng, 72).map(pl => ({ ...pl, star: false, tendency: { archetype: 'slasher', threeRate: 0.08, driveRate: 0.75, passFirst: 0.3 } }));
    let shareA = 0, shareB = 0;
    for (const [seed, a, b] of [[71, shooters, slashers], [72, slashers, shooters]]) {
      const g = await playBasketballGame({ quarterMinutes: 6, seed, homeRoster: a, awayRoster: b });
      const share = rows => sum(rows, 'tpa') / Math.max(1, sum(rows, 'fga'));
      const home = share(g.box.home), away = share(g.box.away);
      if (a === shooters) { shareA += home; shareB += away; } else { shareA += away; shareB += home; }
    }
    expect(shareA / 2).toBeGreaterThan(shareB / 2 + 0.12);
  }, 240000);

  it('about a third of clubs have a star, a clear tier above his team-mates', () => {
    const rng = createRNG(33);
    const rosters = Array.from({ length: 40 }, () => makeRoster(rng, 60));
    const withStar = rosters.filter(r => r.some(pl => pl.star));
    expect(withStar.length).toBeGreaterThan(6);
    expect(withStar.length).toBeLessThan(24);
    withStar.forEach(r => {
      const star = r.find(pl => pl.star);
      const rest = r.filter(pl => pl !== star && !pl.star).map(pl => pl.rating);
      expect(star.rating).toBeGreaterThanOrEqual(Math.max(...rest));
    });
  });

  it('the scouting report names the man to stop', () => {
    const state = freshState(4);
    const opponent = basketballAdapter.teamsByLeague[state.career.leagueIndex].find(n => n !== state.career.teamName);
    const info = basketballAdapter.getScoutingInfo(state.league.teams[opponent].roster);
    expect(info.stop).toBeTruthy();
    expect(info.starters.map(pl => pl.name)).toContain(info.stop.name);
  });
});
