// =====================================================
//  NBA SEASON STRUCTURE
//  82 games, conferences and divisions, standings,
//  play-in and a best-of-seven playoff bracket.
//  Pure logic: no DOM, so it runs headless in tests.
// =====================================================
export const SeasonEngine = (() => {
  'use strict';

  // ── League map ────────────────────────────────────
  const DIVISIONS = {
    Atlantic:  { conf: 'East', teams: ['Celtics', 'Nets', 'Knicks', '76ers', 'Raptors'] },
    Central:   { conf: 'East', teams: ['Bulls', 'Cavaliers', 'Pistons', 'Pacers', 'Bucks'] },
    Southeast: { conf: 'East', teams: ['Hawks', 'Hornets', 'Heat', 'Magic', 'Wizards'] },
    Northwest: { conf: 'West', teams: ['Nuggets', 'Timberwolves', 'Thunder', 'Blazers', 'Jazz'] },
    Pacific:   { conf: 'West', teams: ['Warriors', 'Clippers', 'Lakers', 'Suns', 'Kings'] },
    Southwest: { conf: 'West', teams: ['Mavericks', 'Rockets', 'Grizzlies', 'Pelicans', 'Spurs'] },
  };

  const GAMES = { division: 4, conference: 3, cross: 2 }; // per opponent
  const SEASON_DAYS = 172;   // late October to mid April
  const REST_MIN = 1;        // days between games for the same team, normally

  const rnd = (a, b) => a + Math.random() * (b - a);
  const irnd = (a, b) => Math.floor(rnd(a, b + 1));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const shuffle = arr => {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = irnd(0, i); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  };

  // ── Teams ─────────────────────────────────────────
  // `names` lets a non-NBA league (the G-League tier) reuse the same machinery.
  function buildTeams(names) {
    const mapped = [];
    Object.entries(DIVISIONS).forEach(([div, d]) => {
      d.teams.forEach(name => {
        if (!names || names.includes(name)) mapped.push({ name, conf: d.conf, div });
      });
    });
    // Anything not in the NBA map (G-League) is split into two conferences by order
    const extra = (names || []).filter(n => !mapped.some(t => t.name === n));
    extra.forEach((name, i) => {
      mapped.push({ name, conf: i % 2 ? 'West' : 'East', div: i % 2 ? 'West-Group' : 'East-Group' });
    });
    return mapped.map((t, id) => ({
      id, name: t.name, conf: t.conf, div: t.div,
      strength: clamp(Math.round(rnd(62, 84)), 45, 95),
      w: 0, l: 0, pf: 0, pa: 0, streak: 0, form: [],
    }));
  }

  // ── Fixture list ──────────────────────────────────
  // Division opponents four times, conference three, cross-conference twice:
  // 16 + 30 + 30 = 76 for a 30-team league, topped up to 82 with extra
  // conference games, which is how a real schedule is shaped.
  function buildPairings(teams) {
    const games = [];
    // Alternate hosts within each series; a global repair pass evens out the
    // odd-numbered ones afterwards.
    const add = (a, b, n) => {
      const flip = Math.random() < 0.5;
      for (let i = 0; i < n; i++) {
        const aHome = flip ? i % 2 === 1 : i % 2 === 0;
        games.push(aHome ? { home: a.id, away: b.id } : { home: b.id, away: a.id });
      }
    };
    for (let i = 0; i < teams.length; i++) {
      for (let j = i + 1; j < teams.length; j++) {
        const a = teams[i], b = teams[j];
        const n = a.div === b.div ? GAMES.division : a.conf === b.conf ? GAMES.conference : GAMES.cross;
        add(a, b, n);
      }
    }
    // A real schedule tops 76 up to 82 by playing six of the ten
    // non-division conference opponents a fourth time.
    ['East', 'West'].forEach(conf => {
      const pool = teams.filter(t => t.conf === conf);
      const quota = 82 - (GAMES.division * 4 + GAMES.conference * 10 + GAMES.cross * pool.length);
      if (quota <= 0 || pool.length < 6) return;
      for (let attempt = 0; attempt < 60; attempt++) {
        const need = new Map(pool.map(t => [t.id, quota]));
        const used = new Set();
        const picked = [];
        let stuck = false;
        while (!stuck) {
          const left = pool.filter(t => need.get(t.id) > 0)
            .sort((a, b) => need.get(b.id) - need.get(a.id) || Math.random() - 0.5);
          if (!left.length) break;
          const a = left[0];
          const b = left.slice(1).find(x => x.div !== a.div && !used.has(`${Math.min(a.id, x.id)}-${Math.max(a.id, x.id)}`));
          if (!b) { stuck = true; break; }
          used.add(`${Math.min(a.id, b.id)}-${Math.max(a.id, b.id)}`);
          need.set(a.id, need.get(a.id) - 1);
          need.set(b.id, need.get(b.id) - 1);
          picked.push([a, b]);
        }
        if (!stuck) { picked.forEach(([a, b]) => add(a, b, 1)); break; }
      }
    });
    balanceHomeGames(teams, games);
    return shuffle(games);
  }

  // Flip hosting on individual games until every team hosts the same number.
  function balanceHomeGames(teams, games) {
    const homeOf = () => {
      const c = new Array(teams.length).fill(0);
      games.forEach(g => c[g.home]++);
      return c;
    };
    for (let pass = 0; pass < 2000; pass++) {
      const c = homeOf();
      let hi = 0, lo = 0;
      c.forEach((v, i) => { if (v > c[hi]) hi = i; if (v < c[lo]) lo = i; });
      if (c[hi] - c[lo] <= 1) break;
      const g = games.find(x => x.home === hi && x.away === lo);
      if (g) { g.home = lo; g.away = hi; continue; }
      // No direct meeting to flip: go through a third team
      const bridge = games.find(x => x.home === hi && c[x.away] < c[hi] - 1);
      if (!bridge) break;
      const t = bridge.home; bridge.home = bridge.away; bridge.away = t;
    }
  }

  // Spread the fixtures across the calendar: no team twice in a day, never three
  // games in three days, and back-to-backs kept to roughly a real season's rate.
  function assignDays(teams, games) {
    const lastDays = teams.map(() => []);
    const scheduled = [];
    const pending = games.slice();
    const perDay = games.length / SEASON_DAYS;
    let quota = 0;

    for (let day = 1; day <= SEASON_DAYS && pending.length; day++) {
      quota += perDay;
      // Late in the calendar the backlog has to clear, so ease the constraints
      const pressure = clamp((pending.length / perDay) / (SEASON_DAYS - day + 1), 0, 3);
      const busy = new Set();
      let placed = 0;
      for (let i = 0; i < pending.length && placed < Math.floor(quota); i++) {
        const g = pending[i];
        if (busy.has(g.home) || busy.has(g.away)) continue;
        const ok = [g.home, g.away].every(id => {
          const recent = lastDays[id];
          if (recent.includes(day)) return false;
          const yesterday = recent.includes(day - 1);
          if (yesterday && recent.includes(day - 2)) return false;   // no 3-in-3
          return !yesterday || Math.random() < 0.09 + pressure * 0.12;
        });
        if (!ok) continue;
        g.day = day;
        scheduled.push(g);
        busy.add(g.home); busy.add(g.away);
        lastDays[g.home].push(day); lastDays[g.away].push(day);
        pending.splice(i--, 1);
        placed++;
      }
      quota -= placed;
    }
    let day = SEASON_DAYS;
    while (pending.length) {
      day++;
      const busy = new Set();
      for (let i = 0; i < pending.length; i++) {
        const g = pending[i];
        if (busy.has(g.home) || busy.has(g.away)) continue;
        const clash = [g.home, g.away].some(id => lastDays[id].includes(day - 1) && lastDays[id].includes(day - 2));
        if (clash) continue;
        g.day = day; scheduled.push(g);
        busy.add(g.home); busy.add(g.away);
        lastDays[g.home].push(day); lastDays[g.away].push(day);
        pending.splice(i--, 1);
      }
    }
    return scheduled.sort((a, b) => a.day - b.day);
  }

  function createSeason(names, myTeamName) {
    const teams = buildTeams(names);
    const games = assignDays(teams, buildPairings(teams));
    const me = teams.find(t => t.name === myTeamName) || teams[0];
    return {
      teams, games, day: 0, myTeam: me.id,
      // A 30-team league lands on 82; a smaller tier lands wherever its structure allows
      gamesPerTeam: Math.round(games.length * 2 / teams.length),
      played: 0, playoffs: null, champion: null,
    };
  }

  // ── Resolving games ───────────────────────────────
  // Calibrated against the live engine's own output: ~113 points a side,
  // with a home edge and no ties.
  function resolve(season, game) {
    const home = season.teams[game.home], away = season.teams[game.away];
    const base = (t, edge) => 113 + (t.strength - 73) * 0.85 + edge + rnd(-13, 13);
    let hs = Math.round(base(home, 2.4)), as = Math.round(base(away, 0));
    while (hs === as) hs += irnd(0, 1) ? 2 : -1;  // overtime settles it
    return { hs: Math.max(78, hs), as: Math.max(78, as) };
  }

  // Playoff basketball is tighter: rotations shorten and the better team shows.
  function resolvePlayoff(season, game) {
    const home = season.teams[game.home], away = season.teams[game.away];
    const base = (t, edge) => 110 + (t.strength - 73) * 1.35 + edge + rnd(-9.5, 9.5);
    let hs = Math.round(base(home, 3.2)), as = Math.round(base(away, 0));
    while (hs === as) hs += irnd(0, 1) ? 2 : -1;
    return { hs: Math.max(75, hs), as: Math.max(75, as) };
  }

  function record(season, game, hs, as) {
    const home = season.teams[game.home], away = season.teams[game.away];
    home.pf += hs; home.pa += as; away.pf += as; away.pa += hs;
    const homeWon = hs > as;
    (homeWon ? home : away).w++;
    (homeWon ? away : home).l++;
    home.form.push(homeWon ? 'W' : 'L'); away.form.push(homeWon ? 'L' : 'W');
    if (home.form.length > 10) home.form.shift();
    if (away.form.length > 10) away.form.shift();
    game.hs = hs; game.as = as; game.done = true;
    season.played++;
  }

  // Advance the calendar to the next day. Games involving the player's team are
  // handed back instead of resolved, so the career can offer play-or-simulate.
  function nextFixture(season) {
    return season.games.find(g => !g.done && (g.home === season.myTeam || g.away === season.myTeam)) || null;
  }

  // Resolve every game up to and including `day`, except the player's own.
  function advanceTo(season, day) {
    season.games.forEach(g => {
      if (g.done || g.day > day) return;
      if (g.home === season.myTeam || g.away === season.myTeam) return;
      const { hs, as } = resolve(season, g);
      record(season, g, hs, as);
    });
    season.day = Math.max(season.day, day);
  }

  // ── Standings ─────────────────────────────────────
  const pct = t => (t.w + t.l ? t.w / (t.w + t.l) : 0);
  const diff = t => t.pf - t.pa;

  function standings(season, conf) {
    const pool = season.teams.filter(t => !conf || t.conf === conf);
    return pool.slice().sort((a, b) =>
      pct(b) - pct(a) ||                       // win percentage
      divisionLead(season, b) - divisionLead(season, a) ||
      headToHead(season, b, a) ||
      diff(b) - diff(a) ||
      b.pf - a.pf
    );
  }

  function divisionLead(season, t) {
    const div = season.teams.filter(x => x.div === t.div);
    return div.every(x => pct(t) >= pct(x)) ? 1 : 0;
  }

  function headToHead(season, a, b) {
    let aw = 0, bw = 0;
    season.games.forEach(g => {
      if (!g.done) return;
      const pair = (g.home === a.id && g.away === b.id) || (g.home === b.id && g.away === a.id);
      if (!pair) return;
      const winner = g.hs > g.as ? g.home : g.away;
      if (winner === a.id) aw++; else bw++;
    });
    return aw - bw;
  }

  const gamesLeft = (season, teamId) =>
    season.games.filter(g => !g.done && (g.home === teamId || g.away === teamId)).length;

  // ── Playoffs ──────────────────────────────────────
  // Six seeds direct, 7-10 through the play-in, then best-of-seven rounds.
  const ROUND_LABEL = { playin: 'Play-In', r1: 'Erste Runde', semis: 'Conference Semifinals', conf: 'Conference Finals', finals: 'NBA Finals' };

  function startPlayoffs(season) {
    const seedList = conf => standings(season, conf).slice(0, 10).map(t => t.id);
    const east = seedList('East'), west = seedList('West');
    season.playoffs = {
      stage: 'playin',
      raw: { East: east, West: west },
      seeds: { East: east.slice(0, 6), West: west.slice(0, 6) },
      playin: { East: playInGames(east), West: playInGames(west) },
      series: [],
      champion: null, finalsMVP: null, log: [],
    };
    return season.playoffs;
  }

  // 7v8 for the seven seed; 9v10 to survive; the losers' game for the eight seed.
  function playInGames(order) {
    return [
      { key: 'A', home: order[6], away: order[7], label: '7 gegen 8' },
      { key: 'B', home: order[8], away: order[9], label: '9 gegen 10' },
      { key: 'C', home: null, away: null, label: 'Verlierer A gegen Sieger B' },
    ];
  }

  function makeSeries(round, conf, hi, lo) {
    return { round, conf, hi, lo, wins: { hi: 0, lo: 0 }, games: [], winner: null };
  }

  // 2-2-1-1-1: the higher seed hosts games 1, 2, 5 and 7.
  const seriesHost = n => ([1, 2, 5, 7].includes(n) ? 'hi' : 'lo');

  function nextSeriesGame(series) {
    if (series.winner) return null;
    const n = series.games.length + 1;
    const hostHi = seriesHost(n) === 'hi';
    return { n, home: hostHi ? series.hi : series.lo, away: hostHi ? series.lo : series.hi, series };
  }

  function recordSeriesGame(season, series, game, hs, as) {
    // A decided series takes no further games, however it was reached
    if (series.winner !== null) return series.winner;
    const winnerId = hs > as ? game.home : game.away;
    series.games.push({ n: game.n, home: game.home, away: game.away, hs, as });
    if (winnerId === series.hi) series.wins.hi++; else series.wins.lo++;
    if (series.wins.hi === 4 || series.wins.lo === 4) {
      series.winner = series.wins.hi === 4 ? series.hi : series.lo;
      const w = season.teams[series.winner], l = season.teams[series.winner === series.hi ? series.lo : series.hi];
      season.playoffs.log.push(`${ROUND_LABEL[series.round]}: ${w.name} schlägt ${l.name} ${Math.max(series.wins.hi, series.wins.lo)}:${Math.min(series.wins.hi, series.wins.lo)}`);
    }
    return series.winner;
  }

  // Build the next round once the current one is complete.
  function advanceBracket(season) {
    const po = season.playoffs;
    const done = list => list.length && list.every(s => s.winner !== null);
    const round = r => po.series.filter(s => s.round === r);

    if (po.stage === 'playin') {
      const ready = ['East', 'West'].every(conf => po.playin[conf].every(g => g.done));
      if (!ready) return;
      ['East', 'West'].forEach(conf => {
        const [a, b, c] = po.playin[conf];
        po.seeds[conf][6] = a.winnerId;
        po.seeds[conf][7] = c.winnerId;
      });
      po.stage = 'r1';
      ['East', 'West'].forEach(conf => {
        const s = po.seeds[conf];
        [[0, 7], [3, 4], [2, 5], [1, 6]].forEach(([hi, lo]) => po.series.push(makeSeries('r1', conf, s[hi], s[lo])));
      });
      return;
    }
    if (po.stage === 'r1' && done(round('r1'))) {
      po.stage = 'semis';
      ['East', 'West'].forEach(conf => {
        const w = round('r1').filter(s => s.conf === conf).map(s => s.winner);
        po.series.push(makeSeries('semis', conf, ...bySeed(po, conf, w[0], w[1])));
        po.series.push(makeSeries('semis', conf, ...bySeed(po, conf, w[2], w[3])));
      });
      return;
    }
    if (po.stage === 'semis' && done(round('semis'))) {
      po.stage = 'conf';
      ['East', 'West'].forEach(conf => {
        const w = round('semis').filter(s => s.conf === conf).map(s => s.winner);
        po.series.push(makeSeries('conf', conf, ...bySeed(po, conf, w[0], w[1])));
      });
      return;
    }
    if (po.stage === 'conf' && done(round('conf'))) {
      po.stage = 'finals';
      const [e, w] = ['East', 'West'].map(conf => round('conf').find(s => s.conf === conf).winner);
      const eSeed = po.seeds.East.indexOf(e), wSeed = po.seeds.West.indexOf(w);
      const hi = eSeed <= wSeed ? e : w, lo = hi === e ? w : e;
      po.series.push(makeSeries('finals', 'NBA', hi, lo));
      return;
    }
    if (po.stage === 'finals' && done(round('finals'))) {
      po.stage = 'done';
      po.champion = round('finals')[0].winner;
      season.champion = po.champion;
    }
  }

  // The better regular-season seed is the home team in the next round.
  function bySeed(po, conf, a, b) {
    const seedOf = id => po.seeds[conf].indexOf(id);
    return seedOf(a) <= seedOf(b) ? [a, b] : [b, a];
  }

  const involvesMe = (season, g) => g && (g.home === season.myTeam || g.away === season.myTeam);

  // The next playoff game the player's team has to play, if any.
  function nextPlayoffGame(season) {
    const po = season.playoffs;
    if (!po || po.stage === 'done') return null;
    if (po.stage === 'playin') {
      for (const conf of ['East', 'West']) {
        for (const g of po.playin[conf]) {
          if (g.done || g.home === null) continue;
          if (involvesMe(season, g)) return { kind: 'playin', game: g, conf };
        }
      }
      return null;
    }
    const active = po.series.filter(s => !s.winner && s.round === po.stage);
    for (const s of active) {
      const g = nextSeriesGame(s);
      if (involvesMe(season, g)) return { kind: 'series', game: g, series: s };
    }
    return null;
  }

  // Resolve everything that does not need the player, stopping when it is their turn.
  function runPlayoffs(season, resolveGame = resolvePlayoff) {
    const po = season.playoffs;
    let guard = 0;
    while (po.stage !== 'done' && guard++ < 400) {
      if (nextPlayoffGame(season)) return nextPlayoffGame(season);
      let acted = false;
      if (po.stage === 'playin') {
        for (const conf of ['East', 'West']) {
          const [a, b, c] = po.playin[conf];
          for (const g of [a, b]) {
            if (g.done) continue;
            const r = resolveGame(season, g);
            g.hs = r.hs; g.as = r.as; g.done = true;
            g.winnerId = r.hs > r.as ? g.home : g.away;
            g.loserId = g.winnerId === g.home ? g.away : g.home;
            po.log.push(`Play-In ${conf} (${g.label}): ${season.teams[g.winnerId].name} ${Math.max(g.hs, g.as)}:${Math.min(g.hs, g.as)}`);
            acted = true;
          }
          if (a.done && b.done && c.home === null) {
            c.home = a.loserId; c.away = b.winnerId; acted = true;
          }
          if (c.home !== null && !c.done && !involvesMe(season, c)) {
            const r = resolveGame(season, c);
            c.hs = r.hs; c.as = r.as; c.done = true;
            c.winnerId = r.hs > r.as ? c.home : c.away;
            po.log.push(`Play-In ${conf} (Platz 8): ${season.teams[c.winnerId].name} ${Math.max(c.hs, c.as)}:${Math.min(c.hs, c.as)}`);
            acted = true;
          }
        }
      } else {
        const active = po.series.filter(s => !s.winner && s.round === po.stage);
        for (const s of active) {
          const g = nextSeriesGame(s);
          if (!g || involvesMe(season, g)) continue;
          const r = resolveGame(season, g);
          recordSeriesGame(season, s, g, r.hs, r.as);
          acted = true;
        }
      }
      advanceBracket(season);
      if (!acted && !nextPlayoffGame(season)) advanceBracket(season);
      if (!acted && po.stage !== 'done' && !nextPlayoffGame(season)) break;
    }
    return nextPlayoffGame(season);
  }

  // Record a result the player actually played.
  function recordPlayerPlayoffGame(season, pending, hs, as) {
    if (pending.kind === 'series' && pending.series.winner !== null) return;
    if (pending.kind === 'playin') {
      const g = pending.game;
      if (g.done) return;
      g.hs = hs; g.as = as; g.done = true;
      g.winnerId = hs > as ? g.home : g.away;
      g.loserId = g.winnerId === g.home ? g.away : g.home;
    } else {
      recordSeriesGame(season, pending.series, pending.game, hs, as);
    }
    advanceBracket(season);
  }

  const madePlayoffs = season =>
    !!season.playoffs && season.playoffs.stage !== 'playin' &&
    Object.values(season.playoffs.seeds).some(list => list.includes(season.myTeam));

  return {
    DIVISIONS, SEASON_DAYS,
    createSeason, resolve, record, advanceTo, nextFixture,
    standings, gamesLeft, pct, diff, buildTeams, buildPairings, assignDays,
    startPlayoffs, runPlayoffs, resolvePlayoff, nextPlayoffGame, recordPlayerPlayoffGame,
    advanceBracket, nextSeriesGame, madePlayoffs, ROUND_LABEL,
  };
})();

