// ── Basketball career: season, game day, live match, playoffs ──
// The season structure lives in season.js and the match engine in engine.js.
// This is the layer that joins them to the career screens.
import { render }            from '../../ui/dom.js';
import { addLog }            from '../../ui/log.js';
import { saveGame }          from '../../core/persistence.js';
import { clamp, avgStat, fmt } from '../../core/utils.js';
import { checkAchievements, showAchievement } from '../../core/achievements.js';
import { SeasonEngine }      from './season.js';
import { BasketballEngine }  from './engine.js';
import { basketballAdapter, getLeagueLeaders } from './index.js';
import { generatePlayByPlay, generateQuarterScores } from '../../ui/commentary.js';
import { createRNG, matchSeed } from '../../core/rng.js';

const WEEKLY_SKILL_POINTS = 1;
let pendingGame = null;   // the fixture the live engine is currently playing

const rnd = (r, a, b) => (r || createRNG(Date.now() >>> 0)).randInt(a, b);

// ── Season lifecycle ──────────────────────────────────
export function ensureSeason(state, teamsByLeague) {
  const c = state.career;
  const stale = !c.nba || c.nbaSeason !== c.season || c.nbaTeam !== c.teamName || c.nbaLeague !== c.leagueIndex;
  if (stale) {
    const pool = teamsByLeague[c.leagueIndex] || teamsByLeague[teamsByLeague.length - 1];
    c.nba = SeasonEngine.createSeason(pool, c.teamName, createRNG(matchSeed(state._saveSeed || 42, c.season, 777)));
    c.nbaSeason = c.season;
    c.nbaTeam = c.teamName;
    c.nbaLeague = c.leagueIndex;
    c.weeksPerSeason = c.nba.gamesPerTeam;
    c.lastSkillDay = 0;
    // The player's own club should reflect the player, not a random roll
    const me = c.nba.teams[c.nba.myTeam];
    me.strength = clamp(Math.round((me.strength * 2 + avgStat(state.player)) / 3), 45, 95);
    // Persist immediately: a reload must not regenerate a different schedule
    saveGame(state);
  }
  return c.nba;
}

const myTeam = state => { const s = state.career.nba; return s.teams[s.myTeam]; };
const record = t => `${t.w}-${t.l}`;

// Calendar days pay the weekly skill point, not games played.
function creditSkillDays(state) {
  const c = state.career, season = c.nba;
  while (season.day - (c.lastSkillDay || 0) >= 7) {
    c.lastSkillDay = (c.lastSkillDay || 0) + 7;
    state.player.skillPoints += WEEKLY_SKILL_POINTS;
  }
}

// A basketball career runs on a real calendar, so an off day is a day, not a game.
export function spendRestDay(state, teamsByLeague) {
  const season = ensureSeason(state, teamsByLeague);
  if (!season) return false;
  const next = SeasonEngine.nextFixture(season);
  const limit = next ? next.day : SeasonEngine.SEASON_DAYS + 40;
  // On a game day the calendar cannot move: you have to play or simulate it,
  // otherwise training between fixtures would be free and unlimited.
  if (season.day >= limit) return false;
  season.day = Math.min(season.day + 1, limit);
  SeasonEngine.advanceTo(season, season.day);
  creditSkillDays(state);
  return true;
}

export function nextGameInfo(state) {
  const season = state.career.nba;
  const fixture = SeasonEngine.nextFixture(season);
  if (!fixture) return null;
  const isHome = fixture.home === season.myTeam;
  const mine = season.games.filter(g => g.done && (g.home === season.myTeam || g.away === season.myTeam));
  const lastDay = mine.length ? mine[mine.length - 1].day : -99;
  return {
    fixture, isHome,
    opponent: season.teams[isHome ? fixture.away : fixture.home],
    backToBack: fixture.day === lastDay + 1,
    restDays: Math.max(0, fixture.day - Math.max(season.day, lastDay) - 1),
    played: mine.length,
  };
}

// ── Results ───────────────────────────────────────────
function simulatedLine(state, won, r = state._rng) {
  const s = state.player.stats;
  const g = k => clamp(Math.round(s[k] ?? 50), 15, 99);
  const role = BasketballEngine.ROLE_BY_LABEL[state.player.position] || 'SF';
  const w = { PG: { reb: .35, ast: 1.5 }, SG: { reb: .5, ast: .9 }, SF: { reb: .75, ast: .8 },
              PF: { reb: 1.15, ast: .5 }, C: { reb: 1.4, ast: .45 } }[role];
  const min = clamp(Math.round(22 + (avgStat(state.player) - 50) / 3 + rnd(r, -4, 4)), 8, 40);
  const scoring = (g('3-Pointer') + g('Dunks') + g('Ballhandling')) / 300;
  const fga = Math.max(2, Math.round(min * (0.26 + scoring * 0.30) + rnd(r, -2, 2)));
  const pct = clamp(0.40 + (g('Dunks') + g('3-Pointer')) / 2 / 100 * 0.16 + (won ? 0.02 : -0.02) + rnd(r, -6, 6) / 100, 0.28, 0.66);
  const fgm = Math.round(fga * pct);
  const tpa = Math.round(fga * clamp(g('3-Pointer') / 240, 0.05, 0.55));
  const tpm = Math.round(tpa * clamp(0.30 + (g('3-Pointer') - 55) / 100 * 0.18, 0.15, 0.48));
  const fta = Math.round(fga * rnd(r, 15, 35) / 100);
  const ftm = Math.round(fta * 0.76);
  return {
    min, pts: (fgm - tpm) * 2 + tpm * 3 + ftm, fgm, fga, tpm, tpa, ftm, fta,
    reb: Math.max(0, Math.round(min * 0.14 * w.reb + rnd(r, -1, 2))),
    ast: Math.max(0, Math.round(min * 0.10 * w.ast * (g('IQ') / 70) + rnd(r, -1, 1))),
    stl: Math.max(0, Math.round(min * 0.03 * (g('Defense') / 70) + rnd(r, -1, 1))),
    blk: Math.max(0, Math.round(min * 0.02 * (role === 'C' || role === 'PF' ? 1.8 : 0.6) + rnd(r, -1, 1))),
    tov: Math.max(0, Math.round(min * 0.06 * (1.6 - g('Ballhandling') / 100) + rnd(r, -1, 1))),
    pf: clamp(Math.round(min * 0.07 + rnd(r, -1, 1)), 0, 6),
  };
}

function applyResult(state, { myScore, oppScore, opponentName, line, isPlayoff, restDays = 1, rng }) {
  const c = state.career, p = state.player, r = rng || state._rng;
  const won = myScore > oppScore;
  if (won) c.wins++; else c.losses++;
  const isNBA = c.leagueIndex === 1;
  const money = won ? (isNBA ? rnd(r, 80000, 250000) : rnd(r, 3000, 8000))
                    : (isNBA ? rnd(r, 40000, 120000) : rnd(r, 1200, 4000));
  c.goals += line.pts;
  c.assists += line.ast;
  c.bestMatchGoals = Math.max(c.bestMatchGoals, line.pts);
  p.money += money; p.totalEarned += money;
  // A day off gives most of it back; the second night of a back-to-back does not
  const recovery = restDays <= 0 ? rnd(r, 2, 6) : Math.min(3, restDays) * rnd(r, 11, 17);
  p.energy = clamp(p.energy - rnd(r, 10, 22) + recovery, 0, 100);
  p.morale = won ? clamp(p.morale + rnd(r, 4, 12), 0, 100) : clamp(p.morale - rnd(r, 4, 10), 0, 100);
  p.fame += won ? rnd(r, 2, 6) : rnd(r, 0, 2);
  c.week = Math.min(c.nba.gamesPerTeam, (c.week || 1) + 1);
  addLog(state, `${isPlayoff ? 'Playoffs: ' : ''}${won ? 'Sieg' : 'Niederlage'} gegen ${opponentName} (${myScore}:${oppScore}) — ${line.pts} PTS, ${line.reb} REB, ${line.ast} AST`,
    won ? 'good' : 'bad');
  return money;
}

function recordFixture(state, fixture, myScore, oppScore) {
  const season = state.career.nba;
  const isHome = fixture.home === season.myTeam;
  SeasonEngine.record(season, fixture, isHome ? myScore : oppScore, isHome ? oppScore : myScore);
  SeasonEngine.advanceTo(season, fixture.day);
  creditSkillDays(state);
}

// ── Screens ───────────────────────────────────────────
const hud = state => {
  const p = state.player, c = state.career, t = myTeam(state);
  return `<div class="hud">
    <div class="hud-name">${p.name} <span class="hud-sport basketball">🏀 ${t.name}</span></div>
    <div class="hud-block"><div class="hud-label">Bilanz</div><div class="hud-value">${record(t)}</div></div>
    <div class="hud-block"><div class="hud-label">Spiel</div><div class="hud-value">${c.week}/${c.nba.gamesPerTeam}</div></div>
    <div class="hud-block"><div class="hud-label">Energie</div><div class="hud-value">${p.energy}%</div></div>
    <div class="hud-block"><div class="hud-label">Geld</div><div class="hud-value">€${fmt(p.money)}</div></div>
  </div>`;
};

export function showGameDay(state, App) {
  const season = state.career.nba;
  const info = nextGameInfo(state);
  if (!info) return showPlayoffs(state, App);
  const me = myTeam(state);
  const table = SeasonEngine.standings(season, me.conf);
  const seed = table.findIndex(t => t.id === season.myTeam) + 1;
  const oppSeed = SeasonEngine.standings(season, info.opponent.conf).findIndex(t => t.id === info.opponent.id) + 1;
  const upcoming = season.games.filter(g => !g.done && (g.home === season.myTeam || g.away === season.myTeam)).slice(0, 5);

  render(`<div class="screen">${hud(state)}
    <div class="card gameday">
      <div class="gameday-tag">SPIEL ${info.played + 1} VON ${season.gamesPerTeam} · TAG ${info.fixture.day}</div>
      <div class="gameday-teams">
        <div><small>${info.isHome ? 'HEIM' : 'AUSWÄRTS'}</small><strong>${me.name}</strong><em>${record(me)} · #${seed} ${me.conf}</em></div>
        <span class="gameday-vs">${info.isHome ? 'vs' : '@'}</span>
        <div><small>GEGNER</small><strong>${info.opponent.name}</strong><em>${record(info.opponent)} · #${oppSeed} ${info.opponent.conf}</em></div>
      </div>
      ${info.backToBack
        ? `<div class="gameday-note warn">⚠️ Back-to-Back — zweites Spiel in zwei Tagen</div>`
        : `<div class="gameday-note">${info.restDays} Tag${info.restDays === 1 ? '' : 'e'} Pause seit dem letzten Spiel</div>`}
      <div class="gameday-actions">
        <button class="btn btn-success" onclick="App.bbPlay()" ${state.player.energy < 15 ? 'disabled' : ''}>🏀 Spielen</button>
        <button class="btn btn-primary" onclick="App.bbSimulate()">⏩ Simulieren</button>
        <button class="btn btn-ghost" onclick="App.bbSimSeason()">⏭️ Saison durchsimulieren</button>
      </div>
      ${state.player.energy < 15 ? `<p class="gameday-note warn">Zu wenig Energie zum Spielen — ausruhen oder simulieren.</p>` : ''}
      <h4 class="gameday-sub">Nächste Spiele</h4>
      <div class="fixture-list">${upcoming.map(g => {
        const home = g.home === season.myTeam;
        const opp = season.teams[home ? g.away : g.home];
        return `<div class="fixture"><b>Tag ${g.day}</b><span>${home ? 'vs' : '@'} ${opp.name}</span><i>${record(opp)}</i></div>`;
      }).join('')}</div>
      <div class="gameday-actions">
        <button class="btn btn-ghost btn-sm" onclick="App.bbScout()">🔍 Gegner scouten</button>
        <button class="btn btn-ghost btn-sm" onclick="App.bbStandings()">📋 Tabelle</button>
        <button class="btn btn-ghost btn-sm" onclick="App.bbSchedule()">🗓️ Spielplan</button>
        <button class="btn btn-ghost btn-sm" onclick="App.showHub()">← Übersicht</button>
      </div>
    </div></div>`);
}

export function showStandings(state, App) {
  const season = state.career.nba;
  const conf = c => {
    const rows = SeasonEngine.standings(season, c);
    const leader = rows[0];
    return `<h4 class="table-head">${c === 'East' ? 'Eastern' : 'Western'} Conference</h4>
      <div class="standings-scroll"><table class="standings">
      <thead><tr><th>#</th><th>Team</th><th>W</th><th>L</th><th>PCT</th><th>GB</th><th>DIFF</th><th>Form</th></tr></thead>
      <tbody>${rows.map((t, i) => {
        const gb = ((leader.w - t.w) + (t.l - leader.l)) / 2;
        const cls = t.id === season.myTeam ? 'me' : i === 5 ? 'cut-playoff' : i === 9 ? 'cut-playin' : '';
        return `<tr class="${cls}"><td>${i + 1}</td><td>${t.id === season.myTeam ? '★ ' : ''}${t.name}</td>
          <td>${t.w}</td><td>${t.l}</td><td>${(SeasonEngine.pct(t) * 100).toFixed(1)}</td>
          <td>${gb <= 0 ? '—' : gb.toFixed(1)}</td>
          <td>${SeasonEngine.diff(t) > 0 ? '+' : ''}${SeasonEngine.diff(t)}</td>
          <td class="form">${t.form.slice(-5).join('')}</td></tr>`;
      }).join('')}</tbody></table></div>`;
  };
  render(`<div class="screen">${hud(state)}<div class="card">${conf('East')}${conf('West')}
    <button class="btn btn-primary btn-block" onclick="App.bbGameDay()">← Zurück</button></div></div>`);
}

export function showSchedule(state, App) {
  const season = state.career.nba;
  const mine = season.games.filter(g => g.home === season.myTeam || g.away === season.myTeam);
  let prev = null;
  render(`<div class="screen">${hud(state)}<div class="card">
    <h3 style="margin-bottom:10px">🗓️ Spielplan — ${mine.filter(g => g.done).length}/${season.gamesPerTeam} gespielt</h3>
    <div class="fixture-list">${mine.map(g => {
      const home = g.home === season.myTeam;
      const opp = season.teams[home ? g.away : g.home];
      const b2b = prev !== null && g.day === prev + 1;
      const rest = prev === null ? '' : `${g.day - prev - 1}d`;
      prev = g.day;
      const res = g.done ? ((home ? g.hs > g.as : g.as > g.hs) ? 'W' : 'L') : '';
      return `<div class="fixture ${g.done ? 'played ' + res.toLowerCase() : ''} ${b2b ? 'b2b' : ''}">
        <b>T${g.day}</b><span>${home ? 'vs' : '@'} ${opp.name}</span>
        <i>${g.done ? `${res} ${home ? g.hs : g.as}:${home ? g.as : g.hs}` : (b2b ? '⚠️ B2B' : rest)}</i></div>`;
    }).join('')}</div>
    <button class="btn btn-primary btn-block" onclick="App.bbGameDay()">← Zurück</button></div></div>`);
}

// ── Live match ────────────────────────────────────────
export function playSeasonGame(state, App) {
  const info = nextGameInfo(state);
  if (!info) return showPlayoffs(state, App);
  pendingGame = { fixture: info.fixture, opponent: info.opponent.name, isHome: info.isHome, playoff: null, restDays: info.restDays };
  showMatchScreen(state, App, info.opponent.name, info.isHome);
}

function showMatchScreen(state, App, opponentName, isHome) {
  const me = myTeam(state);
  render(`<div class="screen live-match-screen">${hud(state)}
    <div class="card live-match-card">
      <div class="live-scorebar bb-scorebar">
        <div><small>${isHome ? 'HEIM' : 'AUSWÄRTS'}</small><strong>${me.name}</strong><em>Fouls <span id="bb-home-fouls">0</span></em></div>
        <div class="bb-centre">
          <div class="live-score"><span id="bb-home-score">0</span><i>:</i><span id="bb-away-score">0</span></div>
          <div class="bb-clocks"><b id="bb-quarter">Q1</b><b id="bb-clock">00:00</b><u id="bb-shot">24</u></div>
        </div>
        <div class="live-away"><small>GEGNER</small><strong>${opponentName}</strong><em>Fouls <span id="bb-away-fouls">0</span></em></div>
      </div>
      <div class="live-pitch-wrap bb-court-wrap">
        <canvas id="bb-canvas" width="960" height="540" aria-label="Spielbares Basketballfeld"></canvas>
        <div class="live-kickoff" id="bb-tipoff">
          <span>KARRIERE-SPIEL</span>
          <h2>Bereit für den Tip-off?</h2>
          <p>${me.name} ${isHome ? 'vs' : '@'} ${opponentName}</p>
          <label class="bb-length">Viertellänge
            <select id="bb-quarter-length">
              <option value="2">2 Spielminuten — kurzes Spiel (~4 Min)</option>
              <option value="4">4 Spielminuten — Standard (~8 Min)</option>
              <option value="12">12 Spielminuten — volle NBA-Länge</option>
            </select>
          </label>
          <button class="btn btn-success" onclick="App.bbStartMatch()">Tip-off 🏀</button>
        </div>
        <div class="live-message" id="bb-message"></div>
        <div class="bb-ticker" id="bb-ticker"></div>
        <div class="touch-gamepad" aria-label="Touch-Steuerung">
          <div class="touch-joystick" id="bb-stick"><div class="touch-joystick-ring"></div><div class="touch-joystick-knob" id="bb-knob"></div></div>
          <div class="touch-actions">
            <button class="touch-action touch-sprint" id="bb-sprint" type="button">SPRINT</button>
            <button class="touch-action bb-touch-pass" id="bb-pass" type="button">PASS</button>
            <button class="touch-action touch-shoot" id="bb-shoot" type="button"><span>🏀</span>WURF</button>
          </div>
        </div>
      </div>
      <div class="live-controls">
        <span><kbd>WASD</kbd> bewegen</span><span><kbd>SHIFT</kbd> sprinten</span>
        <span><kbd>LEERTASTE</kbd> halten &amp; loslassen: Wurf — in der Abwehr blocken</span>
        <span><kbd>E</kbd> Pass</span><span><kbd>Q</kbd> Ball klauen</span>
      </div>
      <button class="btn btn-ghost btn-sm live-cancel" onclick="App.bbAbandon()">Spiel abbrechen</button>
    </div></div>`);
  requestAnimationFrame(() => BasketballEngine.preview('bb-canvas'));
}

export function startMatch(state, App) {
  const c = state.career;
  const quarterMinutes = Number(document.getElementById('bb-quarter-length')?.value || 2);
  document.getElementById('bb-tipoff')?.remove();
  const level = c.leagueIndex >= 1 ? 76 : 60;
  const fixtureKey = pendingGame?.fixture ? pendingGame.fixture.day * 10 + (pendingGame.isHome ? 1 : 0) : 9500 + (pendingGame?.playoff?.game?.n || 0);
  BasketballEngine.start({
    canvasId: 'bb-canvas',
    rng: createRNG(matchSeed(state._saveSeed || 42, c.season, fixtureKey)),
    quarterMinutes,
    home: { name: c.teamName, strength: clamp(level + rnd(state._rng, -4, 4), 35, 95) },
    away: { name: pendingGame?.opponent || 'Gegner', strength: clamp(level + rnd(state._rng, -6, 8), 35, 96) },
    human: {
      name: state.player.name, number: 23, position: state.player.position,
      energy: state.player.energy,
      ratings: (() => {
        const s = state.player.stats, g = k => clamp(Math.round(s[k] ?? 50), 15, 99);
        return { speed: g('Speed'), handle: g('Ballhandling'), three: g('3-Pointer'),
                 defense: g('Defense'), rim: g('Dunks'), iq: g('IQ'),
                 reb: clamp(Math.round((g('Dunks') + g('Defense')) / 2), 15, 99),
                 ft: clamp(Math.round((g('3-Pointer') + g('IQ')) / 2), 15, 99) };
      })(),
    },
    onFinish: res => finishMatch(state, App, res),
  });
}

export function abandonMatch(state, App) {
  BasketballEngine.abort();
  pendingGame = null;
  App.showHub();
}

function finishMatch(state, App, res) {
  const me = res.human || { pts: 0, ast: 0, reb: 0 };
  const playedHome = res.score.home, playedAway = res.score.away;
  const pending = pendingGame;
  pendingGame = null;

  // A short match is a real result, but the table has to compare like with like,
  // so anything under full length is projected to 48 minutes — as per-48 numbers
  // work in real basketball.
  const R = BasketballEngine.RULES;
  const playedMinutes = 4 * R.quarterMinutes + Math.max(0, (res.quarters || 4) - 4) * R.otMinutes;
  const factor = clamp(48 / Math.max(1, playedMinutes), 1, 24);
  const scale = v => Math.round((v || 0) * factor);
  const projected = factor > 1.05;
  const myScore = scale(playedHome), oppScore = scale(playedAway);
  const line = projected
    ? { ...me, min: 48, pts: scale(me.pts), reb: scale(me.reb), ast: scale(me.ast) }
    : me;

  const season = state.career.nba;
  let money;
  if (pending?.playoff) {
    const hs = pending.isHome ? myScore : oppScore;
    SeasonEngine.recordPlayerPlayoffGame(season, pending.playoff, hs, pending.isHome ? oppScore : myScore);
    money = applyResult(state, { myScore, oppScore, opponentName: pending.opponent, line, isPlayoff: true, restDays: 2 });
  } else if (pending) {
    recordFixture(state, pending.fixture, myScore, oppScore);
    money = applyResult(state, { myScore, oppScore, opponentName: pending.opponent, line, restDays: pending.restDays });
  }

  saveGame(state);
  checkAchievements(state, basketballAdapter.achievements).forEach(showAchievement);
  saveGame(state);
  App.showMatch({
    result: myScore > oppScore ? 'win' : 'loss',
    opponent: pending?.opponent || res.away, money,
    personal: me.pts, assists: me.ast, humanMinutes: me.min,
    playerGoals: playedHome, oppGoals: playedAway,
    score: `${playedHome} : ${playedAway}`,
    projected: projected ? { factor: factor.toFixed(1), pts: line.pts, score: `${myScore}:${oppScore}` } : null,
    events: res.events.map(e => ({ minute: clockToMinute(e.clock), clock: e.clock, text: e.text, type: e.type })),
    box: res.box, line: me,
    backTo: pending?.playoff ? 'bbPlayoffs' : 'bbGameDay',
  });
}

// "Q2 01:03" → game minute on a 0-48 scale (overtime counts on from 48)
function clockToMinute(clock) {
  const m = /^(OT|Q)(\d*)\s+(\d+):(\d+)/.exec(clock || '');
  if (!m) return 0;
  const period = m[1] === 'OT' ? 5 : Number(m[2]);
  const remaining = Number(m[3]) + Number(m[4]) / 60;
  const length = period > 4 ? BasketballEngine.RULES.otMinutes : BasketballEngine.RULES.quarterMinutes;
  const scale = 12 / Math.max(1, length);
  return Math.round(((period - 1) * length + (length - remaining)) * scale);
}

// ── Simulation ────────────────────────────────────────
// A simulated fixture goes through the same game model as everything else in
// the adapter — rotations, stamina, timeouts, persistent rosters, tendencies —
// against the scheduled opponent. The season then records it exactly as it
// records a game the player played live.
function simulateFixture(state, { opponentName, isHome, backToBack, restDays, seedKey, isPlayoff }) {
  const c = state.career;
  const rng = createRNG(matchSeed(state._saveSeed || 42, c.season, seedKey));
  const season = c.nba;
  // The season rates clubs on a 62-84 scale around 73; the game model expects
  // its own league baseline (30 + 8 per tier) and swings hard around it, so a
  // club's standing is mapped onto that scale rather than passed through raw.
  const oppRow = season.teams.find(t => t.name === opponentName);
  const myRow  = season.teams[season.myTeam];
  const baseline = 30 + c.leagueIndex * 8;
  // 0.4 was swept against the game model: an average club goes ~.500, a 90-rated
  // one ~.900, without the top of the league becoming unbeatable.
  const onSimScale = row => (row ? Math.round(baseline + (row.strength - 73) * 0.4) : undefined);
  const sim = basketballAdapter.simulateGame(state, {
    rng, opponent: opponentName, isHome, backToBack,
    opponentStrength: onSimScale(oppRow), homeStrength: onSimScale(myRow),
  });
  let myScore = sim.homeScore, oppScore = sim.awayScore;
  if (myScore === oppScore) oppScore -= 2;   // the model settles ties, this is belt and braces
  // Everything about this fixture — the game, the garnish on the player's line,
  // the money and the energy swing — comes from the fixture's own RNG, so the
  // same save replays it to the last number.
  const line = { ...simulatedLine(state, myScore > oppScore, rng), pts: sim.human.pts, ast: sim.human.ast, min: sim.human.min };
  const money = applyResult(state, { myScore, oppScore, opponentName, line, restDays, isPlayoff, rng });
  return { sim, myScore, oppScore, line, money };
}

function broadcastResult(state, r, opponentName, backTo) {
  return {
    result: r.myScore > r.oppScore ? 'win' : 'loss',
    opponent: opponentName, money: r.money,
    playerGoals: r.myScore, oppGoals: r.oppScore,
    personal: r.line.pts, assists: r.line.ast, humanMinutes: r.line.min,
    score: `${r.myScore} : ${r.oppScore}`,
    quarters: r.sim.quarters, events: r.sim.events,
    boxScore: r.sim.boxScore, oppBox: r.sim.oppBox, scoutingInfo: r.sim.scoutingInfo,
    simulated: true, line: r.line, backTo,
  };
}

export function simulateNextGame(state, App) {
  const info = nextGameInfo(state);
  if (!info) return showPlayoffs(state, App);
  const r = simulateFixture(state, {
    opponentName: info.opponent.name, isHome: info.isHome, backToBack: info.backToBack,
    restDays: info.restDays, seedKey: info.fixture.day * 10 + (info.isHome ? 1 : 0),
  });
  recordFixture(state, info.fixture, r.myScore, r.oppScore);
  // Check before saving: an achievement earned on this fixture must be in the save
  checkAchievements(state, basketballAdapter.achievements).forEach(showAchievement);
  saveGame(state);
  App.showMatch(broadcastResult(state, r, info.opponent.name, 'bbGameDay'));
}

export function simulateSeason(state, App) {
  const season = state.career.nba;
  let guard = 0;
  while (SeasonEngine.nextFixture(season) && guard++ < 200) {
    const info = nextGameInfo(state);
    const r = simulateFixture(state, {
      opponentName: info.opponent.name, isHome: info.isHome, backToBack: info.backToBack,
      restDays: info.restDays, seedKey: info.fixture.day * 10 + (info.isHome ? 1 : 0),
    });
    recordFixture(state, info.fixture, r.myScore, r.oppScore);
  }
  checkAchievements(state, basketballAdapter.achievements).forEach(showAchievement);
  saveGame(state);
  showPlayoffs(state, App);
}

// ── Playoffs ──────────────────────────────────────────
export function showPlayoffs(state, App) {
  const season = state.career.nba;
  SeasonEngine.advanceTo(season, SeasonEngine.SEASON_DAYS + 40);
  if (!season.playoffs) {
    SeasonEngine.startPlayoffs(season);
    const me = myTeam(state);
    const seed = SeasonEngine.standings(season, me.conf).findIndex(t => t.id === season.myTeam) + 1;
    addLog(state, `Reguläre Saison beendet: ${record(me)}, Platz ${seed} in der ${me.conf === 'East' ? 'Eastern' : 'Western'} Conference`, 'special');
  }
  const po = season.playoffs;
  const pending = SeasonEngine.runPlayoffs(season);
  saveGame(state);
  if (po.stage === 'done') return showSeasonSummary(state, App);

  const me = myTeam(state);
  const stillIn = po.series.some(s => !s.winner && (s.hi === season.myTeam || s.lo === season.myTeam))
    || Object.values(po.playin).some(list => list.some(g => !g.done && (g.home === season.myTeam || g.away === season.myTeam)));

  render(`<div class="screen">${hud(state)}<div class="card">
    <h2 style="margin-bottom:4px">🏆 ${SeasonEngine.ROUND_LABEL[po.stage] || 'Playoffs'}</h2>
    <p style="color:var(--muted);font-size:.85rem;margin-bottom:14px">${me.name} · ${record(me)} in der regulären Saison</p>
    ${pending ? `
      <div class="gameday-teams">
        <div><small>${pending.game.home === season.myTeam ? 'HEIM' : 'AUSWÄRTS'}</small><strong>${me.name}</strong></div>
        <span class="gameday-vs">${pending.game.home === season.myTeam ? 'vs' : '@'}</span>
        <div><small>GEGNER</small><strong>${season.teams[pending.game.home === season.myTeam ? pending.game.away : pending.game.home].name}</strong></div>
      </div>
      <div class="gameday-note">${pending.kind === 'playin' ? 'Play-In-Spiel' : `Spiel ${pending.game.n} der Serie (${pending.series.wins.hi}:${pending.series.wins.lo})`}</div>
      <div class="gameday-actions">
        <button class="btn btn-success" onclick="App.bbPlayoffPlay()">🏀 Spielen</button>
        <button class="btn btn-primary" onclick="App.bbPlayoffSim()">⏩ Simulieren</button>
      </div>`
    : !stillIn ? `<div class="gameday-note warn">Deine Saison ist vorbei. Der Rest der Playoffs läuft ohne dich.</div>
        <button class="btn btn-primary btn-block" onclick="App.bbPlayoffSim()">⏩ Playoffs weiterlaufen lassen</button>`
    : `<button class="btn btn-primary btn-block" onclick="App.bbPlayoffSim()">⏩ Weiter</button>`}
    <div class="bracket">${po.series.map(s => {
      const hi = season.teams[s.hi], lo = season.teams[s.lo];
      const mine = s.hi === season.myTeam || s.lo === season.myTeam;
      return `<div class="series ${mine ? 'mine' : ''} ${s.winner !== null ? 'done' : ''}">
        <span class="series-round">${SeasonEngine.ROUND_LABEL[s.round]}</span>
        <div class="series-teams"><b>${hi.name}</b> ${s.wins.hi} : ${s.wins.lo} <b>${lo.name}</b></div></div>`;
    }).join('')}</div>
    <div class="playoff-log">${po.log.slice(-8).reverse().map(l => `<div>${l}</div>`).join('')}</div>
  </div></div>`);
}

export function playPlayoffGame(state, App) {
  const season = state.career.nba;
  const pending = SeasonEngine.nextPlayoffGame(season);
  if (!pending) return showPlayoffs(state, App);
  const isHome = pending.game.home === season.myTeam;
  const oppId = isHome ? pending.game.away : pending.game.home;
  pendingGame = { fixture: null, opponent: season.teams[oppId].name, isHome, playoff: pending, restDays: 2 };
  showMatchScreen(state, App, season.teams[oppId].name, isHome);
}

export function simulatePlayoffGame(state, App) {
  const season = state.career.nba;
  const pending = SeasonEngine.nextPlayoffGame(season);
  if (!pending) { SeasonEngine.runPlayoffs(season); return showPlayoffs(state, App); }
  const isHome = pending.game.home === season.myTeam;
  const oppId = isHome ? pending.game.away : pending.game.home;
  const gameNo = pending.kind === 'playin' ? 0 : pending.game.n;
  const r = simulateFixture(state, {
    opponentName: season.teams[oppId].name, isHome, backToBack: false, restDays: 2, isPlayoff: true,
    seedKey: 9000 + (pending.series ? season.playoffs.series.indexOf(pending.series) * 10 : 0) + gameNo,
  });
  SeasonEngine.recordPlayerPlayoffGame(season, pending, isHome ? r.myScore : r.oppScore, isHome ? r.oppScore : r.myScore);
  checkAchievements(state, basketballAdapter.achievements).forEach(showAchievement);
  saveGame(state);
  App.showMatch(broadcastResult(state, r, season.teams[oppId].name, 'bbPlayoffs'));
}

export function showSeasonSummary(state, App) {
  const season = state.career.nba;
  const po = season.playoffs;
  const me = myTeam(state);
  const champ = season.teams[po.champion];
  const won = po.champion === season.myTeam;
  if (won) {
    state.career.titles = (state.career.titles || 0) + 1;
    addLog(state, `🏆 NBA CHAMPION mit den ${me.name}!`, 'special');
  } else {
    addLog(state, `Saison beendet. Champion: ${champ.name}.`, 'neutral');
  }
  saveGame(state);
  render(`<div class="screen">${hud(state)}<div class="card match-screen">
    <div style="font-size:1.6rem;font-weight:900;color:${won ? 'var(--gold)' : 'var(--muted)'}">
      ${won ? '🏆 NBA CHAMPION!' : `Champion: ${champ.name}`}</div>
    <p style="color:var(--muted);margin:8px 0 16px">${me.name} · ${record(me)} · Saison ${state.career.season}</p>
    <div class="playoff-log">${po.log.map(l => `<div>${l}</div>`).join('')}</div>
    <button class="btn btn-primary btn-block" onclick="App.bbNextSeason()">Nächste Saison →</button>
  </div></div>`);
}

export function startNextSeason(state, App, teamsByLeague) {
  // App.endSeason() owns the rollover: season number, promotion, relegation,
  // the new club and the end-of-season bonus.
  App.endSeason();
  const c = state.career;
  c.nba = null;
  c.week = 1;
  ensureSeason(state, teamsByLeague);
  saveGame(state);
  App.showHub();
}

// ── Screens that belong to basketball, not to the app shell ──
export function hubSection(state) {
  if (!state.league || !Object.keys(state.league.teams).length) return '';
  const { scorers, assisters } = getLeagueLeaders(state);
  const row = pl => `<div style="display:flex;justify-content:space-between;font-size:.82rem;padding:2px 0">
    <span>${pl.name} <span style="color:var(--muted);font-size:.75rem">(${pl.team})</span></span>
    <strong>${pl.stats.pts} Pts</strong>
  </div>`;
  const rowAst = pl => `<div style="display:flex;justify-content:space-between;font-size:.82rem;padding:2px 0">
    <span>${pl.name} <span style="color:var(--muted);font-size:.75rem">(${pl.team})</span></span>
    <strong>${pl.stats.ast} Ast</strong>
  </div>`;
  return `<div class="card">
    <div style="font-size:.8rem;color:var(--muted);margin-bottom:8px">🏆 LIGA — TOP SCORER</div>
    ${scorers.length ? scorers.map(row).join('') : '<div style="color:var(--muted);font-size:.85rem">Noch keine Saison-Daten.</div>'}
    <div style="font-size:.8rem;color:var(--muted);margin:10px 0 6px">🎯 TOP ASSISTGEBER</div>
    ${assisters.length ? assisters.map(rowAst).join('') : ''}
  </div>`;
}

export function scoutScreen(state, matchCtx, scouting) {
  const c = state.career;
  const cfg = basketballAdapter;
  const starterRows = (scouting.starters || []).map(pl =>
    `<div style="display:flex;justify-content:space-between;font-size:.82rem;padding:3px 0;border-bottom:1px solid rgba(255,255,255,.06)">
      <span><strong>${pl.position}</strong> ${pl.name}</span>
      <span style="color:var(--muted)">${pl.tendency?.archetype || ''} · ${pl.rating} RTG</span>
    </div>`).join('');
  return `<div class="screen match-screen">
    <div class="card">
      <div style="color:var(--muted);font-size:.8rem;margin-bottom:8px">${cfg.icon} ${cfg.name} — Scouting Report</div>
      <div style="font-size:1.1rem;font-weight:bold;margin-bottom:12px">${c.teamName} <span style="color:var(--muted)">vs</span> ${matchCtx.opponent}</div>
      <div style="background:rgba(255,255,255,.05);border-radius:8px;padding:10px;margin-bottom:12px">
        <div style="font-size:.75rem;color:var(--muted);margin-bottom:6px">GEGNER-ANALYSE</div>
        <div style="font-size:.95rem">Stärken: <strong>${scouting.strength}</strong></div>
        <div style="font-size:.9rem;margin-top:4px;color:var(--muted)">Schlüsselspieler: ${scouting.keeper}</div>
      </div>
      <div style="font-size:.75rem;color:var(--muted);margin-bottom:6px">STARTAUFSTELLUNG GEGNER</div>
      ${starterRows}
    </div>
    <button class="btn btn-primary btn-block" onclick="App.bbPlay()">Spielen 🏀</button>
    <button class="btn btn-ghost btn-block" onclick="App.bbGameDay()">← Spieltag</button>
    <button class="btn btn-ghost btn-block" onclick="App.showHub()">← Zurück</button>
  </div>`;
}

export function matchScreen(state, result) {
  const cfg      = basketballAdapter;
  const teamName = state.career.teamName;
  const oppName  = result.opponent;
  const homeTotal = result.playerGoals ?? Number(String(result.score).split(':')[0]) ?? 0;
  const awayTotal = result.oppGoals    ?? Number(String(result.score).split(':')[1]) ?? 0;

  // Deterministic display RNG (does NOT advance the game-state RNG)
  const dSeed = ((result.playerGoals || 0) * 2654435761 + (result.oppGoals || 0) * 1013904223 + ((result.money || 0) & 0xffff)) >>> 0;
  const drng  = createRNG(dSeed || 42);

  // Quarter scores — generated ONCE and shared with play-by-play so markers are consistent
  // Real quarter scores when the game produced them (simulated or played live);
  // a generated split only for results that carry none.
  const homeQs = result.quarters?.home?.length === 4 ? result.quarters.home : generateQuarterScores(homeTotal, drng);
  const awayQs = result.quarters?.away?.length === 4 ? result.quarters.away : generateQuarterScores(awayTotal, drng);

  // Play-by-play commentary
  const { html: pbpHtml, lastPlayerEventText } = generatePlayByPlay(result.events, result, state, drng, homeQs, awayQs);

  // Linescore abbreviations (last word of team name, 3 chars)
  const homeAbbr = teamName.split(' ').pop().slice(0, 3).toUpperCase();
  const awayAbbr = oppName.split(' ').pop().slice(0, 3).toUpperCase();
  const leagueName = cfg.leagues[state.career.leagueIndex] || cfg.name;

  const linescoreHtml =
    `<div class="broadcast-linescore">` +
      `<div class="team-col"></div>` +
      `<div class="q-col">Q1</div><div class="q-col">Q2</div><div class="q-col">Q3</div><div class="q-col">Q4</div>` +
      `<div class="total-col">TOT</div>` +
      `<div class="team-col">◼ ${homeAbbr}</div>` +
      homeQs.map(s => `<div class="q-col">${s}</div>`).join('') +
      `<div class="total-col">${homeTotal}</div>` +
      `<div class="team-col">◼ ${awayAbbr}</div>` +
      awayQs.map(s => `<div class="q-col">${s}</div>`).join('') +
      `<div class="total-col">${awayTotal}</div>` +
    `</div>` +
    `<div style="margin-top:6px;font-size:.75rem;color:var(--muted)">${teamName} vs. ${oppName} · ${leagueName}</div>`;

  // Result banner
  const bannerClass = result.result === 'win' ? 'win' : result.result === 'loss' ? 'loss' : 'draw';
  const bannerText  = result.result === 'win'  ? `🏆 SIEG! +€${fmt(result.money)}`
                    : result.result === 'loss' ? '😤 NIEDERLAGE'
                    : `🤝 UNENTSCHIEDEN +€${fmt(result.money)}`;

  // Box score: a played game brings all ten players from the engine; a simulated
  // one brings both starting fives from the persistent rosters. Names here are
  // the same names the scouting report showed.
  const mkRow = (p, cls = '') =>
    `<tr${cls ? ` class="${cls}"` : ''}><td>${p.name}</td><td>${p.min}</td><td>${p.pts}</td><td>${p.ast}</td><td>${p.reb}</td></tr>`;
  const table = (title, rows) =>
    `<div class="bb-box"><h4>${title}</h4><table class="box-score">` +
      `<thead><tr><th>Spieler</th><th>MIN</th><th>PTS</th><th>AST</th><th>REB</th></tr></thead>` +
      `<tbody>${rows.map(r => mkRow(r, r.human ? 'human-row' : '')).join('')}</tbody></table></div>`;
  let boxScoreHtml = '';
  if (result.box) {
    const rows = side => result.box[side].map(r => ({ name: `${r.human ? '★ ' : ''}${r.name} (${r.role})`, min: r.min.toFixed(1), pts: r.pts, ast: r.ast, reb: r.reb, human: r.human }));
    boxScoreHtml = table(teamName, rows('home')) + table(oppName, rows('away'));
  } else if (result.boxScore) {
    const humanRow = { name: `★ ${state.player.name}`, min: result.humanMinutes ?? drng.randInt(28, 40), pts: result.personal, ast: result.assists, reb: result.line?.reb ?? drng.randInt(2, 10), human: true };
    const home = [humanRow, ...result.boxScore.map(r => ({ name: `${r.name} (${r.position})`, min: r.minutesPlayed, pts: r.pts, ast: r.ast, reb: r.reb }))];
    const away = (result.oppBox || []).map(r => ({ name: `${r.name} (${r.position})`, min: r.minutesPlayed, pts: r.pts, ast: r.ast, reb: r.reb }));
    boxScoreHtml = table(teamName, home) + (away.length ? table(oppName, away) : '');
  }
  const projectedHtml = result.projected
    ? `<p class="projected-note">Gespielt über ${(48 / result.projected.factor).toFixed(0)} Minuten — für Tabelle und Karriere auf 48 Minuten hochgerechnet (${result.projected.score}, ${result.projected.pts} PTS).</p>`
    : '';

  // Replay hint — last player-type event restated dramatically
  const replayHtml = lastPlayerEventText
    ? `<div style="margin:10px 0;color:var(--muted);font-size:.83rem;font-style:italic">🎬 Replay: ${lastPlayerEventText}</div>`
    : '';

  return `<div class="screen match-screen">
    <div class="card">
      <div class="broadcast-header">${linescoreHtml}</div>
      <div class="result-banner ${bannerClass}">
        <div style="font-size:1.6rem;font-weight:900">${bannerText}</div>
        <div style="font-size:.85rem;color:var(--muted);margin-top:4px">Pers. ${result.personal} Punkte · ${result.assists} Assists</div>
      </div>
      ${pbpHtml ? `<div class="match-events" style="max-height:340px;overflow-y:auto">${pbpHtml}</div>` : ''}
      ${replayHtml}
      ${projectedHtml}
      ${boxScoreHtml}
    </div>
    <button class="btn btn-primary btn-block" onclick="App.${result.backTo || 'showHub'}()">Weiter →</button>
  </div>`;
}

export function showScout(state, App) {
  const info = nextGameInfo(state);
  if (!info || !basketballAdapter.getScoutingInfo) return showGameDay(state, App);
  const oppTeamData = state.league?.teams?.[info.opponent.name];
  if (!oppTeamData?.roster) return showGameDay(state, App);
  render(scoutScreen(state, { opponent: info.opponent.name }, basketballAdapter.getScoutingInfo(oppTeamData.roster)));
}

// ── Career hooks: what the app shell calls instead of asking which sport it is ──
export const careerHooks = {
  playMatch(state, App) {
    ensureSeason(state, basketballAdapter.teamsByLeague);
    const season = state.career.nba;
    if (season.playoffs && season.playoffs.stage !== 'done') showPlayoffs(state, App);
    else showGameDay(state, App);
  },
  // A basketball season runs on a calendar: an off day is spent, and on a game
  // day there is none to spend. Returns false when the action must not happen.
  spendDay(state, App, verb) {
    if (spendRestDay(state, basketballAdapter.teamsByLeague)) return true;
    addLog(state, `Spieltag — heute wird gespielt, nicht ${verb}.`, 'neutral');
    saveGame(state);
    showGameDay(state, App);
    return false;
  },
  simSeason(state, App) { simulateSeason(state, App); },
  hubSection,
  matchScreen,
};
