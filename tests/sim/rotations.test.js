// #48 rotations and #49 fatigue in the live engine.
import { describe, it, expect } from 'vitest';
import { playBasketballGame } from './harness.js';

const sum = (rows, k) => rows.reduce((a, r) => a + (r[k] || 0), 0);

describe('rotations (#48)', () => {
  it('fields ten men a side whose minutes add up to the game', async () => {
    for (const seed of [11, 12, 13]) {
      const g = await playBasketballGame({ quarterMinutes: 12, seed });
      for (const side of ['home', 'away']) {
        expect(g.box[side]).toHaveLength(10);
        const expected = (12 * 4 + Math.max(0, g.quarters - 4) * 1) * 5;
        expect(Math.abs(sum(g.box[side], 'min') - expected)).toBeLessThan(1.5);
        const mins = g.box[side].map(r => r.min).sort((a, b) => b - a);
        expect(mins[0]).toBeLessThan(44);           // nobody plays the whole game
        expect(mins[4]).toBeGreaterThan(20);        // five real starters
        expect(mins[9]).toBeGreaterThan(0);         // the whole bench sees the floor
      }
    }
  }, 120000);
});

describe('fatigue (#49)', () => {
  it('players who never rest shoot worse in the fourth quarter than in the first', async () => {
    let q1 = { fgm: 0, fga: 0 }, q4 = { fgm: 0, fga: 0 };
    for (const seed of [21, 22, 23, 24, 25, 26]) {
      const g = await playBasketballGame({ quarterMinutes: 12, seed, noRotations: true });
      for (const side of ['home', 'away']) {
        const qs = g.quarterShooting[side];
        q1.fgm += qs[0].fgm; q1.fga += qs[0].fga; q4.fgm += qs[3].fgm; q4.fga += qs[3].fga;
      }
    }
    expect(q4.fgm / q4.fga).toBeLessThan(q1.fgm / q1.fga);
  }, 240000);
});
