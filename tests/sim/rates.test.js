// Gates the basketball engine's statistical realism against NBA averages.
// Rates are noisy over a handful of games, so the bands in targets.js are wider
// than season-to-season variation: they catch a broken model, not a drifting one.
import { describe, it, expect } from 'vitest';
import { playBasketballGame } from './harness.js';
import { TARGETS, evaluate } from './targets.js';

// Eight games is not enough to settle these rates — two of them sit near a
// band edge and flap. Fourteen is stable and still runs in about twenty seconds.
const GAMES = Number(process.env.SIM_GAMES || 16);
const MINUTES = 12;

describe('basketball box-score realism', () => {
  let measured, lines, games;

  it(`plays ${GAMES} full games`, async () => {
    const totals = {};
    const bump = (k, v) => { totals[k] = (totals[k] || 0) + v; };
    lines = []; games = [];
    for (let i = 0; i < GAMES; i++) {
      const g = await playBasketballGame({ quarterMinutes: MINUTES });
      games.push(g);
      bump('pts', g.score.home + g.score.away);
      [...g.box.home, ...g.box.away].forEach(p => {
        lines.push(p);
        ['fgm','fga','tpm','tpa','ftm','fta','oreb','dreb','ast','stl','blk','tov','pf','min'].forEach(k => bump(k, p[k] || 0));
      });
    }
    const n = GAMES * 2;
    measured = {
      'FG%': totals.fgm / totals.fga * 100,
      '3P%': totals.tpm / totals.tpa * 100,
      'FT%': totals.ftm / totals.fta * 100,
      '3PA share': totals.tpa / totals.fga * 100,
      'OREB%': totals.oreb / (totals.oreb + totals.dreb) * 100,
      'PTS': totals.pts / n, 'FGA': totals.fga / n, 'FTA': totals.fta / n,
      'REB': (totals.oreb + totals.dreb) / n, 'AST': totals.ast / n,
      'TOV': totals.tov / n, 'STL': totals.stl / n, 'BLK': totals.blk / n, 'PF': totals.pf / n,
    };
    expect(games).toHaveLength(GAMES);
  }, 120000);

  it('every rate sits inside its band', () => {
    const results = evaluate(measured);
    // Report every rate, so a failure says which one drifted and by how much
    const report = results.map(r => `${r.ok ? 'ok ' : 'OUT'} ${r.name} ${r.value.toFixed(1)} (band ${r.band})`).join('\n');
    const drifted = results.filter(r => !r.ok).map(r => `${r.name} ${r.value.toFixed(1)} outside ${r.band}`);
    expect(drifted.join('; '), `\n${report}\n`).toBe('');
  });

  it('no player monopolises his team\'s shots', () => {
    expect(Math.max(...lines.map(p => p.fga))).toBeLessThanOrEqual(TARGETS._maxPlayerFga);
  });

  it('box score arithmetic holds', () => {
    const bad = lines.filter(p =>
      p.fgm > p.fga || p.tpm > p.tpa || p.ftm > p.fta || p.tpa > p.fga ||
      p.pts !== (p.fgm - p.tpm) * 2 + p.tpm * 3 + p.ftm);
    expect(bad).toEqual([]);
  });

  it('minutes add up and no game ends level', () => {
    games.forEach(g => {
      ['home', 'away'].forEach(side => {
        const mins = g.box[side].reduce((a, p) => a + p.min, 0);
        expect(Math.abs(mins - (MINUTES * 4 + Math.max(0, g.quarters - 4)) * 5)).toBeLessThan(1.5);
      });
      expect(g.score.home).not.toBe(g.score.away);
    });
  });
});
