// Epic #3 for football: table, fixtures, contracts, injuries, position
// weights, ageing. Pure model, seeded, no DOM.
import { describe, it, expect } from 'vitest';
import * as S from '../../src/sports/football/season.js';
import { createRNG } from '../../src/core/rng.js';

const NAMES = ['FC Bayern','Dortmund','Leipzig','Leverkusen','Frankfurt','Stuttgart','Wolfsburg','Hoffenheim','Freiburg','Mainz','Augsburg','Bochum','Gladbach','Union Berlin'];
const player = (over = {}) => ({ position: 'Stürmer', age: 22, energy: 100, stats: { Tempo: 50, Technik: 50, Schuss: 50, Dribbling: 50, Kondition: 50, Kopfball: 50 }, injury: null, suspension: 0, yellowCards: 0, ...over });

describe('league and fixtures', () => {
  const rng = createRNG(3);
  const table = S.initLeagueTable(NAMES, 'Mainz', 0, rng);
  const fixtures = S.generateFixtures(table, 'Mainz', rng);

  it('is a ten-team league with the player in it', () => {
    expect(table).toHaveLength(S.LEAGUE_SIZE);
    expect(table.filter(t => t.isPlayer)).toHaveLength(1);
    expect(table.find(t => t.isPlayer).name).toBe('Mainz');
  });
  it('plays every rival home and away, plus two cup rounds, on unique weeks inside the season', () => {
    const league = fixtures.filter(f => f.type === 'league');
    expect(league).toHaveLength(18);
    table.filter(t => !t.isPlayer).forEach(r => {
      expect(league.filter(f => f.opponent === r.name && f.home)).toHaveLength(1);
      expect(league.filter(f => f.opponent === r.name && !f.home)).toHaveLength(1);
    });
    expect(fixtures.filter(f => f.type === 'cup')).toHaveLength(2);
    const weeks = fixtures.map(f => f.week);
    expect(new Set(weeks).size).toBe(weeks.length);
    expect(Math.max(...weeks)).toBeLessThan(S.SEASON_WEEKS);
  });
  it('keeps the table balanced while the rivals play', () => {
    const r = createRNG(8);
    for (let w = 0; w < 20; w++) S.simulateRivalFixtures(table, r);
    const gf = table.reduce((a, t) => a + t.gf, 0), ga = table.reduce((a, t) => a + t.ga, 0);
    expect(gf).toBe(ga);
    table.forEach(t => expect(t.pts).toBe(3 * t.w + t.d));
    const sorted = S.sortTable(table);
    sorted.forEach((t, i) => { if (i) expect(sorted[i - 1].pts).toBeGreaterThanOrEqual(t.pts); });
  });
  it('is reproducible from the seed', () => {
    const a = S.generateFixtures(S.initLeagueTable(NAMES, 'Mainz', 0, createRNG(5)), 'Mainz', createRNG(6));
    const b = S.generateFixtures(S.initLeagueTable(NAMES, 'Mainz', 0, createRNG(5)), 'Mainz', createRNG(6));
    expect(a).toEqual(b);
  });
});

describe('position weights', () => {
  it('rates a keeper by his hands, not his shot', () => {
    const keeper = player({ position: 'Torwart', stats: { Tempo: 40, Technik: 40, Schuss: 90, Dribbling: 40, Kondition: 40, Kopfball: 40 } });
    const striker = { ...keeper, position: 'Stürmer' };
    expect(S.positionRating(keeper)).toBeLessThan(S.positionRating(striker));
    expect(S.trainingBonus(keeper, 'Kopfball')).toBe(1);
    expect(S.trainingBonus(keeper, 'Schuss')).toBe(0);
  });
});

describe('injuries, cards and ageing', () => {
  it('rolls injuries at a low rate and never on top of one', () => {
    let hits = 0; const rng = createRNG(11);
    for (let i = 0; i < 400; i++) { const p = player(); if (S.injuryRoll(p, rng)) hits++; }
    expect(hits).toBeGreaterThan(10); expect(hits).toBeLessThan(80);
    const hurt = player({ injury: { weeksLeft: 3, type: 'minor' } });
    expect(S.injuryRoll(hurt, rng)).toBeNull();
  });
  it('suspends on the third yellow and counts the weeks down', () => {
    const p = player({ yellowCards: 2 });
    let msg = null; const rng = createRNG(2);
    while (!msg) msg = S.cardRoll(p, rng);
    expect(p.suspension).toBe(1); expect(p.yellowCards).toBe(0); expect(S.unavailable(p)).toMatch(/Gesperrt/);
    const state = { player: p, career: { fb: { contract: { wage: 100 } } } }; p.money = 0; p.totalEarned = 0;
    S.tickWeek(state);
    expect(p.suspension).toBe(0); expect(p.money).toBe(100);
  });
  it('grows the young and wears down the old', () => {
    const young = player({ age: 21 }), old = player({ age: 34 });
    S.ageCurve(young, createRNG(1)); S.ageCurve(old, createRNG(1));
    const sum = p => Object.values(p.stats).reduce((a, b) => a + b, 0);
    expect(sum(young)).toBeGreaterThan(300); expect(sum(old)).toBeLessThan(300);
  });
});

describe('season outcome', () => {
  it('promotes the leader and relegates the bottom two', () => {
    const mk = (pts) => ({ career: { leagueIndex: 2, fb: { table: [{ name: 'me', isPlayer: true, pts, gf: 0, ga: 0 }, ...[1,2,3,4,5,6,7,8,9].map(i => ({ name: 'r' + i, pts: i * 5, gf: 0, ga: 0 }))] } } });
    expect(S.seasonOutcome(mk(99), 7).promoted).toBe(true);
    expect(S.seasonOutcome(mk(0), 7).relegated).toBe(true);
    const mid = S.seasonOutcome(mk(24), 7); expect(mid.promoted || mid.relegated).toBe(false);
  });
});
