// #10: a match and a season are functions of a seed. The same seed replays the
// same game to the last box-score line, and nothing outside rng.js reaches for
// Math.random.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { playBasketballGame } from './harness.js';
import { SeasonEngine as S } from '../../src/sports/basketball/season.js';
import { createRNG } from '../../src/core/rng.js';

const NBA = ['Lakers','Celtics','Warriors','Bulls','Heat','Knicks','Nets','Bucks','Suns','Clippers',
  'Nuggets','Mavericks','Spurs','Rockets','Thunder','Blazers','Jazz','Timberwolves','Kings','Pelicans',
  'Grizzlies','Pacers','76ers','Raptors','Cavaliers','Magic','Hornets','Hawks','Wizards','Pistons'];

const walk = dir => readdirSync(dir).flatMap(f => { const p = join(dir, f); return statSync(p).isDirectory() ? walk(p) : [p]; });

describe('determinism', () => {
  it('Math.random is used nowhere in src/ except rng.js', () => {
    const offenders = walk('src').filter(f => f.endsWith('.js') && !f.endsWith('core/rng.js') && readFileSync(f, 'utf8').includes('Math.random'));
    expect(offenders).toEqual([]);
  });

  it('the same seed replays the same match', async () => {
    const a = await playBasketballGame({ quarterMinutes: 2, seed: 77 });
    const b = await playBasketballGame({ quarterMinutes: 2, seed: 77 });
    const c = await playBasketballGame({ quarterMinutes: 2, seed: 78 });
    expect(a.score).toEqual(b.score);
    expect(a.box).toEqual(b.box);
    expect(a.events.map(e => e.text)).toEqual(b.events.map(e => e.text));
    expect(JSON.stringify(a.box)).not.toEqual(JSON.stringify(c.box));
  }, 60000);

  it('the same seed builds the same schedule and resolves it the same way', () => {
    const one = S.createSeason(NBA, 'Lakers', createRNG(9));
    const two = S.createSeason(NBA, 'Lakers', createRNG(9));
    expect(one.games.map(g => `${g.day}:${g.home}-${g.away}`)).toEqual(two.games.map(g => `${g.day}:${g.home}-${g.away}`));
    expect(one.teams.map(t => t.strength)).toEqual(two.teams.map(t => t.strength));
    // results depend on the stored seed, not on call order or module state
    const r1 = S.resolve(one, one.games[10]), r2 = S.resolve(two, two.games[10]);
    expect(r1).toEqual(r2);
    S.resolve(one, one.games[3]);                       // an unrelated draw in between
    expect(S.resolve(one, one.games[10])).toEqual(r1);   // still the same
  });
});
