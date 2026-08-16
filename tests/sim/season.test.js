// Structural checks on the season: a schedule that does not add up makes every
// standing, seed and bracket downstream of it wrong.
import { describe, it, expect } from 'vitest';
import { SeasonEngine as S } from '../../src/sports/basketball/season.js';

const NBA = ['Lakers','Celtics','Warriors','Bulls','Heat','Knicks','Nets','Bucks','Suns','Clippers',
  'Nuggets','Mavericks','Spurs','Rockets','Thunder','Blazers','Jazz','Timberwolves','Kings','Pelicans',
  'Grizzlies','Pacers','76ers','Raptors','Cavaliers','Magic','Hornets','Hawks','Wizards','Pistons'];

const gamesFor = (s, id) => s.games.filter(g => g.home === id || g.away === id);
const playAll = s => s.games.forEach(g => { const r = S.resolve(s, g); S.record(s, g, r.hs, r.as); });

describe('season schedule', () => {
  const s = S.createSeason(NBA, 'Lakers');

  it('has 30 teams split evenly by conference', () => {
    expect(s.teams).toHaveLength(30);
    expect(s.teams.filter(t => t.conf === 'East')).toHaveLength(15);
  });

  it('gives every team 82 games, 41 of them at home', () => {
    s.teams.forEach(t => {
      expect(gamesFor(s, t.id)).toHaveLength(82);
      expect(s.games.filter(g => g.home === t.id)).toHaveLength(41);
    });
    expect(s.games).toHaveLength(1230);
  });

  it('never schedules a team twice in a day or three games in three days', () => {
    s.teams.forEach(t => {
      const days = gamesFor(s, t.id).map(g => g.day).sort((a, b) => a - b);
      for (let i = 1; i < days.length; i++) expect(days[i]).not.toBe(days[i - 1]);
      for (let i = 2; i < days.length; i++) {
        expect(days[i] === days[i - 1] + 1 && days[i - 1] === days[i - 2] + 1).toBe(false);
      }
    });
  });

  it('leaves a plausible number of back-to-backs', () => {
    let b2b = 0;
    s.teams.forEach(t => {
      const days = gamesFor(s, t.id).map(g => g.day).sort((a, b) => a - b);
      for (let i = 1; i < days.length; i++) if (days[i] === days[i - 1] + 1) b2b++;
    });
    expect(b2b / 30).toBeGreaterThan(8);
    expect(b2b / 30).toBeLessThan(25);
  });
});

describe('standings and playoffs', () => {
  it('keeps the league books balanced', () => {
    const s = S.createSeason(NBA, 'Lakers');
    playAll(s);
    const w = s.teams.reduce((a, t) => a + t.w, 0), l = s.teams.reduce((a, t) => a + t.l, 0);
    expect(w).toBe(l);
    expect(w + l).toBe(30 * 82);
    expect(s.teams.reduce((a, t) => a + t.pf, 0)).toBe(s.teams.reduce((a, t) => a + t.pa, 0));
    const avg = s.teams.reduce((a, t) => a + t.pf, 0) / (w + l);
    expect(avg).toBeGreaterThan(100);
    expect(avg).toBeLessThan(128);
    const table = S.standings(s, 'East');
    table.forEach((t, i) => { if (i) expect(S.pct(table[i - 1])).toBeGreaterThanOrEqual(S.pct(t)); });
  });

  it('runs a bracket to a champion, favouring the better seed', () => {
    let higher = 0, total = 0;
    for (let k = 0; k < 4; k++) {
      const s = S.createSeason(NBA, 'Lakers');
      playAll(s);
      S.startPlayoffs(s);
      let guard = 0;
      while (s.playoffs.stage !== 'done' && guard++ < 300) {
        const pending = S.runPlayoffs(s);
        if (!pending) continue;
        const r = S.resolvePlayoff(s, pending.game);
        S.recordPlayerPlayoffGame(s, pending, r.hs, r.as);
      }
      expect(s.playoffs.stage).toBe('done');
      expect(s.champion).not.toBeNull();
      expect(s.playoffs.series).toHaveLength(15);
      s.playoffs.series.forEach(x => {
        expect(Math.max(x.wins.hi, x.wins.lo)).toBe(4);
        expect(x.games.length).toBeLessThanOrEqual(7);
        total++; if (x.winner === x.hi) higher++;
      });
    }
    const pct = higher / total * 100;
    expect(pct).toBeGreaterThan(60);
    expect(pct).toBeLessThan(90);
  }, 60000);
});
