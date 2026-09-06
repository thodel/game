// #50: timeouts, inbounds and end-of-game situations in the live engine.
import { describe, it, expect } from 'vitest';
import { playBasketballGame } from './harness.js';

describe('timeouts and inbounds (#50)', () => {
  it('a full game has inbounds, timeouts and set plays that reach their shooter', async () => {
    const tot = { inbounds: 0, timeouts: 0, fiveSeconds: 0, backcourt: 0, setPlays: 0, setPlayTouches: 0, lastSecondShots: 0 };
    for (const seed of [41, 42, 43]) {
      const g = await playBasketballGame({ quarterMinutes: 12, seed });
      const s = g.stats;
      tot.inbounds += s.inbounds; tot.timeouts += s.timeouts.home + s.timeouts.away;
      tot.fiveSeconds += s.fiveSeconds; tot.backcourt += s.backcourt;
      tot.setPlays += s.setPlays; tot.setPlayTouches += s.setPlayTouches; tot.lastSecondShots += s.lastSecondShots;
      expect(s.timeouts.home).toBeLessThanOrEqual(7 + Math.max(0, g.quarters - 4) * 2);
      expect(s.inbounds).toBeGreaterThan(60);                    // nearly every dead ball is an inbound
    }
    expect(tot.timeouts).toBeGreaterThanOrEqual(2);              // coaches stop runs
    expect(tot.fiveSeconds).toBeLessThanOrEqual(2);              // the AI gets the ball in
    expect(tot.backcourt).toBeLessThanOrEqual(3);                // and over halfway
    expect(tot.setPlayTouches).toBeGreaterThanOrEqual(Math.min(1, tot.setPlays));
    expect(tot.lastSecondShots).toBeGreaterThanOrEqual(1);       // somebody takes the last shot of a period
  }, 240000);
});

describe('end-of-game situations (#50)', () => {
  const scenario = (quarter, home, away, clock = 30) => ({ quarter, clock, home, away, possession: 'away' });

  it('trailing by five with thirty seconds left, the defence fouls on purpose', async () => {
    let fouls = 0;
    for (const seed of [51, 52, 53]) {
      const g = await playBasketballGame({ quarterMinutes: 12, seed, scenario: scenario(4, 95, 100) });
      fouls += g.stats.intentionalFouls;
      expect(g.stats.intentionalByQ[4] || 0).toBeGreaterThanOrEqual(1);
      expect(g.quarters).toBeGreaterThanOrEqual(4);
    }
    expect(fouls).toBeGreaterThanOrEqual(3);
  }, 120000);

  it('the same score in the second quarter is a normal defensive possession', async () => {
    for (const seed of [51, 52]) {
      const g = await playBasketballGame({ quarterMinutes: 12, seed, scenario: scenario(2, 45, 50) });
      // the game plays on to a real fourth quarter, so only the second-quarter stretch counts
      expect(g.stats.intentionalByQ[2] || 0).toBe(0);
    }
  }, 120000);
});
