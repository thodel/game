// #28: offence sets, help defence, fast breaks, league difficulty, and
// team-mates who get the ball to the player at a rate that fits him.
import { describe, it, expect } from 'vitest';
import { playBasketballGame } from './harness.js';
import { makeRoster } from '../../src/sports/basketball/index.js';
import { createRNG } from '../../src/core/rng.js';

const sum = (rows, k) => rows.reduce((a, r) => a + (r[k] || 0), 0);

describe('offence and defence sets (#28)', () => {
  it('a full game has ball screens, breaks and box-outs, and the player is neither the only scorer nor ignored', async () => {
    for (const seed of [81, 82, 83]) {
      const g = await playBasketballGame({ quarterMinutes: 12, seed });
      expect(g.stats.screens).toBeGreaterThan(15);
      expect(g.stats.fastBreaks).toBeGreaterThan(3);
      const me = g.box.home.find(r => r.human);
      const share = me.fga / Math.max(1, sum(g.box.home, 'fga'));
      expect(share).toBeGreaterThan(0.09);   // the lowest-usage starter in the NBA takes about a tenth of the shots
      expect(share).toBeLessThan(0.34);
      expect(g.stats.humanTouches).toBeGreaterThan(40);
      // somebody other than the human scores in double figures
      expect(g.box.home.filter(r => !r.human && r.pts >= 10).length).toBeGreaterThanOrEqual(2);
    }
  }, 240000);
});

describe('league difficulty (#28)', () => {
  it('an NBA defence reads bad spacing and doubles the ball; a lower league never does', async () => {
    const rng = createRNG(44);
    const home = makeRoster(rng, 70), away = makeRoster(rng, 70);
    let doublesHi = 0, doublesLo = 0;
    for (const seed of [91, 92]) {
      const hi = await playBasketballGame({ quarterMinutes: 12, seed, homeRoster: home, awayRoster: away, difficulty: 1 });
      const lo = await playBasketballGame({ quarterMinutes: 12, seed, homeRoster: home, awayRoster: away, difficulty: 0.3 });
      doublesHi += hi.stats.doubles; doublesLo += lo.stats.doubles;
    }
    expect(doublesHi).toBeGreaterThan(10);
    expect(doublesLo).toBe(0);
  }, 300000);
});
