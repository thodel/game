// #59: the spread of results between equal teams. Two identical rosters, a
// human whose ratings and style are exactly what his slot would hold, and the
// human-specific rules off — so nothing but the game itself separates the sides.
//
// The bias band is the one that matters most: a hidden edge for either side,
// whatever its source, is the bug this test was written to catch (a loop-order
// artefact once handed the away team six points a game). The spread bands are
// wide: every per-team component of the engine disperses like the NBA's (score
// SD ~12, FG% ~5, points per possession ~0.11), but the two teams' scores
// barely correlate (0.1 against a real ~0.35), so equal-team margins run an SD
// of ~17 against the league's ~13-14. That remaining gap is #59's open item;
// the sample here is too small to gate it tighter without flapping.
import { describe, it, expect } from 'vitest';
import { playBasketballGame } from './harness.js';
import { makeRoster } from '../../src/sports/basketball/index.js';
import { createRNG } from '../../src/core/rng.js';

const N = Number(process.env.SPREAD_GAMES || 32);
const flat = r => r.map((p, i) => ({ ...p, star: false, rating: i < 5 ? 70 : 58 }));
// exactly what fromRoster() gives a 70-rated slasher small forward
const twin = {
  name: 'Test Player', number: 23, position: 'Small Forward', energy: 100,
  ratings: { speed: 78, handle: 67, three: 65, defense: 67, rim: 83, iq: 69, reb: 68, ft: 74 },
  tendency: { archetype: 'slasher', threeRate: 0.1, driveRate: 0.7, passFirst: 0.2 },
};

describe('spread between equal teams (#59)', () => {
  it('no hidden edge for either side, and a realistic spread of margins', async () => {
    const margins = [];
    for (let i = 0; i < N; i++) {
      const r = createRNG(4000 + i);
      const g = await playBasketballGame({ quarterMinutes: 12, seed: 1500 + i, homeRoster: flat(makeRoster(r, 70)), awayRoster: flat(makeRoster(r, 70)), human: twin, noHumanBias: true });
      margins.push(g.score.home - g.score.away);
    }
    const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
    const sd = Math.sqrt(mean(margins.map(m => (m - mean(margins)) ** 2)));
    const abs = margins.map(Math.abs);
    const report = `mean margin ${mean(margins).toFixed(1)} (bias), sd ${sd.toFixed(1)}, mean |margin| ${mean(abs).toFixed(1)}, 25+ in ${abs.filter(m => m >= 25).length}/${N}`;
    expect(Math.abs(mean(margins)), report).toBeLessThan(6);          // ±6 is two standard errors at this sample
    expect(sd, report).toBeGreaterThan(9);
    expect(sd, report).toBeLessThan(21);
    expect(mean(abs), report).toBeLessThan(18);
    expect(abs.filter(m => m >= 25).length / N, report).toBeLessThan(0.34);
  }, 600000);
});
