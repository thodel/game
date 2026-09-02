// #63: one game model behind every basketball result. The simulation must not
// touch the career, must play the scheduled opponent with the same roster the
// scouting report described, and must hand the season a result of the same
// shape a played game produces.
import { describe, it, expect, beforeAll } from 'vitest';
import { basketballAdapter, initLeagueRoster } from '../../src/sports/basketball/index.js';
import { createRNG } from '../../src/core/rng.js';
import { newState } from '../../src/core/state.js';

function freshState(seed = 7) {
  const rng = createRNG(seed);
  const state = newState('basketball', 'Test Spieler', 'Small Forward', basketballAdapter, rng);
  state._rng = rng; state._saveSeed = seed;
  initLeagueRoster(state, basketballAdapter, rng);
  return state;
}

describe('simulateGame', () => {
  let state, before, sim, opponent;
  beforeAll(() => {
    state = freshState();
    opponent = basketballAdapter.teamsByLeague[state.career.leagueIndex].find(n => n !== state.career.teamName);
    before = JSON.stringify({ career: state.career, player: state.player });
    sim = basketballAdapter.simulateGame(state, { rng: createRNG(99), opponent, isHome: true, backToBack: false });
  });

  it('leaves the career and the player untouched', () => {
    expect(JSON.stringify({ career: state.career, player: state.player })).toBe(before);
  });

  it('plays the scheduled opponent, not a random one', () => {
    expect(sim.opponent).toBe(opponent);
  });

  it('produces a basketball-shaped, decisive score with quarters that add up', () => {
    expect(sim.homeScore).not.toBe(sim.awayScore);
    expect(sim.homeScore).toBeGreaterThan(60);
    expect(sim.awayScore).toBeGreaterThan(60);
    expect(sim.quarters.home).toHaveLength(4);
    expect(sim.quarters.home.reduce((a, b) => a + b, 0)).toBe(sim.homeScore);
    expect(sim.quarters.away.reduce((a, b) => a + b, 0)).toBe(sim.awayScore);
  });

  it('names the same opposing players the scouting report named', () => {
    const scouted = sim.scoutingInfo.starters.map(p => p.name);
    const boxed = sim.oppBox.map(p => p.name);
    scouted.forEach(name => expect(boxed).toContain(name));
  });

  it('keeps the player\'s own team-mates from one game to the next', () => {
    const first = sim.boxScore.map(p => p.name);
    const again = basketballAdapter.simulateGame(state, { rng: createRNG(100), opponent, isHome: false });
    expect(again.boxScore.map(p => p.name)).toEqual(first);
  });

  it('carries events on a 0-48 minute scale', () => {
    sim.events.forEach(e => {
      expect(Number.isFinite(e.minute)).toBe(true);
      expect(e.minute).toBeGreaterThanOrEqual(0);
      expect(e.minute).toBeLessThanOrEqual(48);
    });
  });
});
