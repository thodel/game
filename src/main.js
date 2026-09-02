// src/main.js — entry point for Sports Career Game
import { createRNG, matchSeed } from './core/rng.js';
import { newState }             from './core/state.js';
import { saveGame, loadGame, clearSave, allSaves, exportSave, importSave } from './core/persistence.js';
import { avgStat, clamp, fmt }  from './core/utils.js';
import { adapters, getAdapter } from './sports/adapters.js';
import { footballAdapter }   from './sports/football/index.js';
import { basketballAdapter } from './sports/basketball/index.js';
import * as bb                from './sports/basketball/career.js';
import * as fb                from './sports/football/career.js';
import { drawMatch as drawFootballMatch3D, drawStadiumPerson } from './sports/football/render.js';
import { render, renderStats, renderSeasonBar, statColor } from './ui/dom.js';
import { addLog }               from './ui/log.js';

let state = null;
let liveMatch = null;

const App = {
  start() {
    const saved = loadGame();
    if (saved && !saved._loadError) {
      state = saved;
      if (!state._saveSeed) state._saveSeed = Date.now();
      state._rng = createRNG(state._saveSeed);
      App.showHub();
    } else if (saved && saved._loadError) {
      showLoadError(saved);
    } else {
      App.showTitle();
    }
  },

  // ── Navigation ─────────────────────────────────────
  showTitle() { render(_titleScreen()); },
  showCreate(sport) {
    const cfg = getAdapter(sport);
    render(_createScreen(cfg));
  },
  showHub() { render(_hubScreen()); },
  showMatch(result) { if (state?._quickGame) result.backTo = 'showTitle'; render(_matchScreen(result)); },

  // ── Actions ─────────────────────────────────────────
  doPlayMatch() {
    if (!state) return;
    getAdapter(state.sport).career.playMatch(state, App);
  },

  // ── Basketball season ──────────────────────────────
  bbGameDay()     { bb.ensureSeason(state, basketballAdapter.teamsByLeague); bb.showGameDay(state, App); },
  bbPlay()        { bb.playSeasonGame(state, App); },
  bbStartMatch()  { bb.startMatch(state, App); },
  bbAbandon()     { bb.abandonMatch(state, App); },
  bbSimulate()    { bb.simulateNextGame(state, App); },
  bbSimSeason()   { bb.simulateSeason(state, App); },
  bbStandings()   { bb.showStandings(state, App); },
  bbSchedule()    { bb.showSchedule(state, App); },
  bbPlayoffs()    { bb.showPlayoffs(state, App); },
  bbPlayoffPlay() { bb.playPlayoffGame(state, App); },
  bbPlayoffSim()  { bb.simulatePlayoffGame(state, App); },
  bbNextSeason()  { bb.startNextSeason(state, App, basketballAdapter.teamsByLeague); },

  // Scouting report for the next scheduled opponent (Epic #52)
  bbScout()       { bb.showScout(state, App); },

  // ── Football career ────────────────────────────────
  fbAcceptTransfer(i) { fb.acceptTransfer(state, App, i); },
  fbDeclineOffers()   { fb.declineOffers(state, App); },
  fbKeepPlaying()     { fb.keepPlaying(state, App); },
  fbRetire()          { fb.retire(state, App); state = null; },

  doBasketballMatch() { App.bbSimulate(); },

  doTraining(stat) {
    const p = state.player, c = state.career;
    if (p.energy < 20) return;
    // Every action spends time; the sport decides what a unit of time is
    if (!getAdapter(state.sport).career.spendDay(state, App, 'trainiert')) return;
    const bonus = getAdapter(state.sport).trainingBonus?.(state, stat) || 0;
    const gain = state._rng.randInt(2, 6) + bonus;
    p.stats[stat] = clamp(p.stats[stat] + gain, 1, 99);
    p.energy = clamp(p.energy - state._rng.randInt(10, 20), 0, 100);
    p.money -= 50;
    addLog(state, `Training: ${stat} +${gain}${bonus ? ' (Positionsbonus)' : ''}`, 'good');
    saveGame(state); App.showHub();
  },

  doRest() {
    const p = state.player, c = state.career;
    if (!getAdapter(state.sport).career.spendDay(state, App, 'ausgeruht')) return;
    p.energy = clamp(p.energy + state._rng.randInt(25, 45), 0, 100);
    p.morale = clamp(p.morale + state._rng.randInt(5, 15), 0, 100);
    addLog(state, `Erholt. Energie +${25}, Moral +${10}`, 'neutral');
    saveGame(state); App.showHub();
  },

  doSimSeason() {
    if (!state) return;
    getAdapter(state.sport).career.simSeason(state, App);
  },

  // Leave this career (its slot stays) and go back to the title
  doNewGame() { state = null; App.showTitle(); },
  // Delete this career's slot, then the title
  deleteCurrentCareer() { if (state) clearSave(state.player?.name); state = null; App.showTitle(); },

  // ── Save slots ─────────────────────────────────────
  continueGame(name) {
    const saved = loadGame(name);
    if (!saved || saved._loadError) return showLoadError(saved || { _loadError: 'MISSING' });
    state = saved;
    if (!state._saveSeed) state._saveSeed = Date.now();
    state._rng = createRNG(state._saveSeed);
    App.showHub();
  },
  confirmDeleteSave(name) {
    _modal(`<h3>⚠️ Karriere löschen?</h3><p>Die Karriere von <strong>${name}</strong> wird unwiderruflich gelöscht.</p>
      <div class="modal-btns"><button class="btn btn-danger" onclick="App.deleteSave('${name.replace(/'/g, "\\'")}')">Ja, löschen</button>
      <button class="btn btn-ghost" onclick="this.closest('.modal-bg').remove()">Abbrechen</button></div>`);
  },
  deleteSave(name) { clearSave(name); if (state?.player?.name === name) state = null; _closeModal(); App.showTitle(); },

  // ── Quick Game: one match, no career, nothing saved ──
  showQuickGame() {
    render(`<div class="screen"><div class="card" style="text-align:center;padding:32px 24px">
      <h2 style="margin-bottom:8px">⚡ Quick Game</h2>
      <p style="color:var(--muted);margin-bottom:24px">Ein Spiel, kein Speichern, kein Setup — einfach spielen.</p>
      <div class="sport-cards" style="max-width:420px;margin:0 auto 24px">${adapters.map(a => `
        <div class="sport-card ${a.color}" onclick="App.startQuickGame('${a.id}')"><span class="sport-icon">${a.icon}</span><h2>${a.name}</h2><p>Schnelles Match</p></div>`).join('')}</div>
      <button class="btn btn-ghost" onclick="App.showTitle()">← Zurück</button></div></div>`);
  },
  startQuickGame(sportId) {
    const adapter = getAdapter(sportId);
    const seed = Date.now();
    const rng = createRNG(seed);
    const first = ['Max', 'Leon', 'Felix', 'Luca', 'Noah', 'Elias', 'Jonas', 'Tim', 'Ben', 'Jan'];
    const last  = ['Müller', 'Schmidt', 'Weber', 'Wagner', 'Fischer', 'Becker', 'Hoffmann', 'Koch', 'Richter', 'Klein'];
    const name = `${first[rng.randInt(0, first.length - 1)]} ${last[rng.randInt(0, last.length - 1)]}`;
    const position = adapter.positions[rng.randInt(0, adapter.positions.length - 1)];
    state = newState(sportId, name, position, adapter, rng);
    state._quickGame = true;
    state._saveSeed = seed; state._rng = rng;
    // a quick game deserves a player who can play
    Object.keys(state.player.stats).forEach(k => { state.player.stats[k] = Math.min(99, state.player.stats[k] + 12); });
    if (adapter.initLeagueRoster) adapter.initLeagueRoster(state, rng);
    (adapter.career.quickMatch || adapter.career.playMatch)(state, App);
  },

  // ── Exit menu (#38) ────────────────────────────────
  showExitMenu() {
    // A match screen counts even before tip-off / kick-off: leaving it is leaving the game
    const inMatch = !!liveMatch || (typeof bb.isLive === 'function' && bb.isLive())
      || !!document.getElementById('bb-canvas') || !!document.getElementById('football-canvas') || !!document.getElementById('stadium-intro-canvas');
    _modal(inMatch
      ? `<h3>⏏️ Spiel verlassen</h3><p style="margin-bottom:16px">Das laufende Spiel wird abgebrochen.</p>
         <div class="modal-btns" style="flex-direction:column;gap:10px">
           <button class="btn btn-primary" onclick="App.exitMatchSave()">🏳️ Aufgeben &amp; speichern<div style="font-size:.75rem;font-weight:400;margin-top:3px">Zählt als Niederlage, Fortschritt bleibt</div></button>
           <button class="btn btn-ghost" onclick="App.exitMatchNoSave()">↩️ Verlassen ohne speichern<div style="font-size:.75rem;font-weight:400;margin-top:3px">Zurück zum letzten gespeicherten Stand</div></button>
           <button class="btn btn-ghost btn-sm" onclick="this.closest('.modal-bg').remove()">← Weiterspielen</button></div>`
      : `<h3>🏠 Spiel beenden</h3><p style="margin-bottom:16px">Was möchtest du tun?</p>
         <div class="modal-btns" style="flex-direction:column;gap:10px">
           <button class="btn btn-primary" onclick="App.saveAndQuit()">💾 Speichern &amp; zum Menü</button>
           <button class="btn btn-ghost" onclick="App.quitNoSave()">🗑️ Beenden ohne speichern<div style="font-size:.75rem;font-weight:400;margin-top:3px">Zurück zum letzten gespeicherten Stand</div></button>
           <button class="btn btn-ghost btn-sm" onclick="this.closest('.modal-bg').remove()">← Zurück zum Spiel</button></div>`);
  },
  saveAndQuit() { _closeModal(); saveGame(state); state = null; App.showTitle(); },
  quitNoSave()  { _closeModal(); state = null; App.showTitle(); },
  exitMatchSave() {
    _closeModal();
    _stopLiveMatches();
    const adapter = getAdapter(state.sport), p = state.player;
    p.morale = clamp(p.morale - state._rng.randInt(3, 8), 0, 100);
    addLog(state, 'Spiel abgebrochen — als Niederlage gewertet', 'bad');
    // the sport records the forfeit where the game would have counted (table, fixture, career)
    if (adapter.career.forfeitMatch) adapter.career.forfeitMatch(state, App);
    else { state.career.losses++; adapter.career.spendDay?.(state, App, 'gespielt'); }
    saveGame(state); App.showHub();
  },
  exitMatchNoSave() {
    _closeModal();
    _stopLiveMatches();
    const saved = state?._quickGame ? null : loadGame(state?.player?.name);
    if (saved && !saved._loadError) { state = saved; state._rng = createRNG(state._saveSeed || Date.now()); addLog(state, 'Spiel verlassen — kein Fortschritt gespeichert', 'neutral'); App.showHub(); }
    else { state = null; App.showTitle(); }
  },

  spendSkillPoint(stat) {
    const p = state.player;
    if (p.skillPoints <= 0) return;
    p.stats[stat] = clamp(p.stats[stat] + state._rng.randInt(4, 8), 1, 99);
    p.skillPoints--;
    saveGame(state); App.showHub();
  },

  // ── Season ─────────────────────────────────────────
  endSeason() {
    const c = state.career, p = state.player;
    const total = c.wins + c.losses + c.draws;
    const winRate = total > 0 ? c.wins / total : 0;
    const adapter = getAdapter(state.sport);
    const PROMOTION = 0.55, RELEGATION = 0.30;
    let promoted = false, relegated = false;
    // A sport with a table lets the table decide; otherwise the win rate does
    const verdict = adapter.career?.seasonOutcome ? adapter.career.seasonOutcome(state) : null;
    if (verdict) { promoted = verdict.promoted; relegated = verdict.relegated; }
    else if (winRate >= PROMOTION && c.leagueIndex < adapter.leagues.length - 1) promoted = true;
    else if (winRate < RELEGATION && c.leagueIndex > 0) relegated = true;
    if (promoted) { c.leagueIndex++; c.promotions++; }
    if (relegated) { c.leagueIndex--; c.relegations++; }
    if (promoted) {
      const teams = adapter.teamPool(c.leagueIndex);
      c.teamName = teams[Math.floor(state._rng.next() * teams.length)];
      addLog(state, `Aufstieg in die ${adapter.leagues[c.leagueIndex]}! 🎉`, 'good');
    } else if (relegated) {
      const teams = adapter.teamPool(c.leagueIndex);
      c.teamName = teams[Math.floor(state._rng.next() * teams.length)];
      addLog(state, `Abstieg in die ${adapter.leagues[c.leagueIndex]} 😤`, 'bad');
    }
    c.season++; c.week = 1; c.wins = 0; c.losses = 0; c.draws = 0;
    p.age++;
    const bonus = adapter.seasonBonus ? adapter.seasonBonus(state) : state._rng.randInt(2000, 8000) * (c.leagueIndex + 1);
    p.money += bonus; p.totalEarned += bonus;
    // Re-init league rosters for the new season (basketball only) (Epic #51)
    if (adapter.initLeagueRoster) {
      state.league = { teams: {}, season: c.season };
      adapter.initLeagueRoster(state, state._rng);
    }
  },

  // ── Interactive Football Match ───────────────────────
  showFootballMatch() {
    const opponent = footballAdapter.createMatch(state).opponent;
    liveMatch = { opponent, phase: 'intro', keys: new Set(), raf: null, cleanup: null, introStart: performance.now(), introTimer: null };
    render(_footballIntroScreen(state, opponent));
    liveMatch.introTimer = setTimeout(() => App.skipStadiumIntro(), 6500);
    liveMatch.raf = requestAnimationFrame(stadiumIntroFrame);
  },

  skipStadiumIntro() {
    if (!liveMatch || liveMatch.phase !== 'intro') return;
    clearTimeout(liveMatch.introTimer);
    if (liveMatch.raf) cancelAnimationFrame(liveMatch.raf);
    liveMatch.phase = 'ready';
    render(_footballKickoffScreen(state, liveMatch.opponent));
  },

  startFootballMatch() {
    if (!liveMatch || liveMatch.phase !== 'ready') return;
    const canvas = document.getElementById('football-canvas');
    const kickoff = document.getElementById('live-kickoff');
    if (!canvas) return;
    kickoff?.remove();
    const players = [..._createFootballLineup('home'), ..._createFootballLineup('away')];
    const human = players.find(p => p.human);
    Object.assign(liveMatch, {
      phase: 'playing', canvas, context: canvas.getContext('2d'), players, human,
      ball: { x: 480, y: 270, r: 8, vx: 0, vy: 0, owner: null },
      score: { home: 0, away: 0 }, events: [], elapsed: 0, last: performance.now(),
      resetUntil: 0, touch: { x: 0, y: 0, sprint: false, pointerId: null },
    });
    const down = e => {
      liveMatch?.keys.add(e.code);
      if (['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)) e.preventDefault();
      if (e.code === 'Space') _footballShoot(liveMatch?.human);
    };
    const up = e => liveMatch?.keys.delete(e.code);
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    const cleanupTouch = _setupTouchGamepad(liveMatch);
    liveMatch.cleanup = () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); cleanupTouch(); };
    _footballFrame(performance.now());
  },

  abandonFootballMatch() {
    if (liveMatch?.raf) cancelAnimationFrame(liveMatch.raf);
    liveMatch?.cleanup?.();
    liveMatch = null;
    App.showHub();
  },
};

// ── Football engine ───────────────────────────────────
function stadiumIntroFrame(now) {
  if (!liveMatch || liveMatch.phase !== 'intro') return;
  const progress = Math.min(1, (now - liveMatch.introStart) / 6500);
  const bar = document.getElementById('stadium-progress-bar');
  if (bar) bar.style.width = `${progress * 100}%`;
  const canvas = document.getElementById('stadium-intro-canvas');
  if (canvas) _drawStadiumIntro(canvas.getContext('2d'), canvas.width, canvas.height, progress);
  if (progress < 1) liveMatch.raf = requestAnimationFrame(stadiumIntroFrame);
  else App.skipStadiumIntro();
}

function _drawStadiumIntro(ctx, w, h, t) {
  ctx.fillStyle = '#07131b'; ctx.fillRect(0, 0, w, h);
  const ground = ctx.createLinearGradient(0, h * 0.45, 0, h);
  ground.addColorStop(0, '#0d3320'); ground.addColorStop(1, '#1a5c30');
  ctx.fillStyle = ground; ctx.fillRect(0, h * 0.45, w, h * 0.55);
  for (let i = 0; i < 60; i++) {
    const x = (i / 60) * w; ctx.fillStyle = `rgba(255,255,255,${0.15 + Math.sin(t * Math.PI * 2 + i) * 0.05})`;
    ctx.fillRect(x, h * 0.42, 2, 4);
  }
  // the two teams walk out of the tunnel, keepers first
  for (let i = 0; i < 11; i++) {
    const prog = clamp(t * 1.6 - i * 0.06, 0, 1);
    const yBase = h * 0.62 + i * 14, x = w * 0.5 + (prog - 1) * (w * 0.42 + i * 9);
    drawStadiumPerson(ctx, x - 60, yBase, 'home', i === 0, 0.9 - i * 0.03);
    drawStadiumPerson(ctx, w - x + 60, yBase, 'away', i === 0, 0.9 - i * 0.03);
  }
  ctx.fillStyle = `rgba(255,255,200,${t})`; ctx.font = `bold ${Math.round(48 + t * 20)}px Segoe UI`;
  ctx.textAlign = 'center'; ctx.fillText('🏟️ FUSSBALL', w / 2, h * 0.3);
}

function _footballFrame(now) {
  const m = liveMatch;
  if (!m || m.phase !== 'playing') return;
  const dt = Math.min(0.035, Math.max(0, (now - m.last) / 1000));
  m.last = now;
  _updateFootballMatch(m, dt);
  _drawFootballMatch(m);
  if (m.phase === 'playing') m.raf = requestAnimationFrame(_footballFrame);
}

function _updateFootballMatch(m, dt) {
  if (m.resetUntil > performance.now()) return;
  m.elapsed += dt;
  if (m.elapsed >= 60) return _finishFootballMatch();
  const k = m.keys;
  let dx = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0);
  let dy = (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0) - (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0);
  if (Math.hypot(m.touch.x, m.touch.y) > 0.08) { dx = m.touch.x; dy = m.touch.y; }
  const len = Math.hypot(dx, dy) || 1;
  const speed = k.has('ShiftLeft') || k.has('ShiftRight') || m.touch.sprint ? 225 : 170;
  m.human.vx = dx / len * speed; m.human.vy = dy / len * speed;
  m.players.forEach(p => {
    p.cooldown = Math.max(0, p.cooldown - dt);
    if (!p.human) _updateFootballAI(m, p);
    const mov = Math.hypot(p.vx || 0, p.vy || 0);
    if (mov > 4) { p.facing = Math.atan2(p.vy, p.vx); p.stride = (p.stride || 0) + dt * mov * 0.08; }
    p.x = clamp(p.x + (p.vx || 0) * dt, 48 + p.r, 912 - p.r);
    p.y = clamp(p.y + (p.vy || 0) * dt, 34 + p.r, 506 - p.r);
  });
  _updateFootballBall(m, dt);
  const matchMinute = Math.min(90, Math.floor(m.elapsed * 1.5));
  const clock = document.getElementById('live-clock');
  if (clock) clock.textContent = `${String(matchMinute).padStart(2,'0')}:${String(Math.floor((m.elapsed*90)%60)).padStart(2,'0')}`;
}

function _updateFootballAI(m, p) {
  let tx = p.homeX, ty = p.homeY, speed = 115;
  if (p.keeper) {
    tx = p.team === 'home' ? 92 : 868; ty = clamp(m.ball.y, 205, 335);
  } else if (m.ball.owner === p) {
    tx = p.team === 'home' ? 930 : 30; ty = 270; speed = 142;
    if (Math.abs(tx - p.x) < 230 && p.cooldown <= 0) _footballShoot(p);
  } else if (!m.ball.owner || m.ball.owner.team !== p.team) {
    const mates = m.players.filter(q => q.team === p.team && !q.keeper);
    const nearest = mates.reduce((a, b) => _footballDist(a, m.ball) < _footballDist(b, m.ball) ? a : b);
    if (nearest === p) { tx = m.ball.x; ty = m.ball.y; speed = 155; }
  }
  const d = Math.hypot(tx - p.x, ty - p.y) || 1;
  p.vx = (tx - p.x) / d * speed; p.vy = (ty - p.y) / d * speed;
}

function _updateFootballBall(m, dt) {
  const b = m.ball;
  if (b.owner) {
    const p = b.owner;
    b.x = p.x + (p.team === 'home' ? p.r + 7 : -p.r - 7); b.y = p.y + 2;
    for (const q of m.players) {
      if (q.team !== p.team && _footballDist(q, p) < q.r + p.r + 3 && q.cooldown <= 0) {
        q.cooldown = 0.65; p.cooldown = 0.3; b.owner = q; break;
      }
    }
    return;
  }
  b.x += b.vx * dt; b.y += b.vy * dt;
  const drag = Math.pow(0.985, dt * 60); b.vx *= drag; b.vy *= drag;
  if (b.y < 34 + b.r || b.y > 506 - b.r) { b.vy *= -0.75; b.y = clamp(b.y, 34 + b.r, 506 - b.r); }
  const inGoal = b.y > 205 && b.y < 335;
  if (b.x < 48 && inGoal) return _footballGoal('away');
  if (b.x > 912 && inGoal) return _footballGoal('home');
  if (b.x < 48 + b.r || b.x > 912 - b.r) { b.vx *= -0.75; b.x = clamp(b.x, 48 + b.r, 912 - b.r); }
  for (const p of m.players) {
    if (_footballDist(p, b) < p.r + b.r + 3 && Math.hypot(b.vx, b.vy) < 300 && p.cooldown <= 0) { b.owner = p; break; }
  }
}

function _footballShoot(player) {
  const m = liveMatch;
  if (!m || !player || m.ball.owner !== player) return;
  const tx = player.team === 'home' ? 940 : 20, ty = 270 + state._rng.randInt(-65, 65);
  const d = Math.hypot(tx - player.x, ty - player.y) || 1;
  m.ball.owner = null; m.ball.vx = (tx - player.x) / d * 500; m.ball.vy = (ty - player.y) / d * 500; player.cooldown = 0.5;
}

function _footballGoal(team) {
  const m = liveMatch;
  if (!m || m.phase !== 'playing') return;
  m.score[team]++;
  const minute = Math.min(90, Math.max(1, Math.round(m.elapsed * 1.5)));
  m.events.push({ minute, text: team === 'home' ? 'Tor für dein Team! ⚽' : 'Gegentor 😤', type: team === 'home' ? 'player' : 'opponent' });
  const scoreEl = document.getElementById(`live-${team}-score`);
  if (scoreEl) scoreEl.textContent = m.score[team];
  const msg = document.getElementById('live-message');
  if (msg) { msg.textContent = team === 'home' ? 'TOR!' : 'GEGENTOR'; msg.classList.add('show'); setTimeout(() => msg.classList.remove('show'), 1000); }
  m.resetUntil = performance.now() + 1500;
  setTimeout(() => _resetFootballPositions(team === 'home' ? 'away' : 'home'), 1250);
}

function _resetFootballPositions(kickoffTeam) {
  const m = liveMatch; if (!m || m.phase !== 'playing') return;
  m.players.forEach(p => { p.x = p.homeX; p.y = p.homeY; p.vx = p.vy = 0; });
  Object.assign(m.ball, { x: 480, y: 270, vx: 0, vy: 0, owner: m.players.find(p => p.team === kickoffTeam && !p.keeper) });
  m.resetUntil = 0;
}

function _finishFootballMatch() {
  const m = liveMatch; if (!m || m.phase !== 'playing') return;
  m.phase = 'finished';
  if (m.raf) cancelAnimationFrame(m.raf);
  m.cleanup?.();
  const result = m.score.home > m.score.away ? 'win' : m.score.home < m.score.away ? 'loss' : 'draw';
  const c = state.career, p = state.player;
  if (result === 'win') c.wins++; else if (result === 'loss') c.losses++; else c.draws++;
  const money = (result === 'win' ? state._rng.randInt(800, 2000) : result === 'draw' ? state._rng.randInt(200, 600) : state._rng.randInt(100, 400)) * (c.leagueIndex + 1);
  const personal = m.score.home > 0 ? state._rng.randInt(0, m.score.home) : 0;
  const assists = Math.max(0, m.score.home - personal);
  c.goals += personal; c.assists += assists; c.bestMatchGoals = Math.max(c.bestMatchGoals, personal);
  p.money += money; p.totalEarned += money; p.energy = clamp(p.energy - state._rng.randInt(15, 30), 0, 100);
  p.morale = result === 'win' ? clamp(p.morale + state._rng.randInt(5, 15), 0, 100) : result === 'loss' ? clamp(p.morale - state._rng.randInt(5, 12), 0, 100) : p.morale;
  p.fame += result === 'win' ? state._rng.randInt(3, 8) : state._rng.randInt(0, 2);
  const hooks = getAdapter('football').career;
  hooks.afterMatch(state, { result, myGoals: m.score.home, oppGoals: m.score.away, personal, rng: state._rng });
  hooks.spendDay(state, App);
  const matchResult = { playerGoals: m.score.home, oppGoals: m.score.away, result, opponent: m.opponent, events: m.events, money, personal, assists, score: `${m.score.home} : ${m.score.away}` };
  addLog(state, `${result === 'win' ? 'Sieg' : result === 'draw' ? 'Unentschieden' : 'Niederlage'} gegen ${m.opponent} (${matchResult.score})`, result === 'win' ? 'good' : result === 'loss' ? 'bad' : 'neutral');
  saveGame(state);
  liveMatch = null;
  App.showMatch(matchResult);
}

function _footballDist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }

function _setupTouchGamepad(match) {
  const joystick = document.getElementById('touch-joystick');
  const knob = document.getElementById('touch-joystick-knob');
  const sprint = document.getElementById('touch-sprint');
  const shoot = document.getElementById('touch-shoot');
  if (!joystick || !knob || !sprint || !shoot) return () => {};
  const moveJoystick = e => {
    if (match.touch.pointerId !== e.pointerId) return;
    e.preventDefault();
    const rect = joystick.getBoundingClientRect(), cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;
    const max = rect.width * 0.31, rawX = e.clientX - cx, rawY = e.clientY - cy, d = Math.hypot(rawX, rawY) || 1, scale = Math.min(1, max / d);
    match.touch.x = rawX * scale / max; match.touch.y = rawY * scale / max;
    knob.style.transform = `translate(${rawX * scale}px, ${rawY * scale}px)`;
  };
  const startJoystick = e => { e.preventDefault(); match.touch.pointerId = e.pointerId; joystick.setPointerCapture(e.pointerId); moveJoystick(e); };
  const endJoystick = e => { if (match.touch.pointerId !== e.pointerId) return; match.touch.pointerId = null; match.touch.x = 0; match.touch.y = 0; knob.style.transform = 'translate(0,0)'; };
  const sprintOn = e => { e.preventDefault(); match.touch.sprint = true; sprint.classList.add('pressed'); };
  const sprintOff = () => { match.touch.sprint = false; sprint.classList.remove('pressed'); };
  const shootBall = e => { e.preventDefault(); shoot.classList.add('pressed'); _footballShoot(match.human); setTimeout(() => shoot.classList.remove('pressed'), 120); };
  joystick.addEventListener('pointerdown', startJoystick);
  joystick.addEventListener('pointermove', moveJoystick);
  joystick.addEventListener('pointerup', endJoystick);
  joystick.addEventListener('pointercancel', endJoystick);
  sprint.addEventListener('pointerdown', sprintOn);
  sprint.addEventListener('pointerup', sprintOff);
  sprint.addEventListener('pointercancel', sprintOff);
  shoot.addEventListener('pointerdown', shootBall);
  return () => {
    joystick.removeEventListener('pointerdown', startJoystick);
    joystick.removeEventListener('pointermove', moveJoystick);
    joystick.removeEventListener('pointerup', endJoystick);
    joystick.removeEventListener('pointercancel', endJoystick);
    sprint.removeEventListener('pointerdown', sprintOn);
    sprint.removeEventListener('pointerup', sprintOff);
    sprint.removeEventListener('pointercancel', sprintOff);
    shoot.removeEventListener('pointerdown', shootBall);
  };
}

function _drawFootballMatch(m) { drawFootballMatch3D(m); }




// ── Screen builders ───────────────────────────────────
function _titleScreen() {
  const sportButtons = adapters.map(a => `
    <div class="sport-card ${a.color}" onclick="App.showCreate('${a.id}')">
      <span class="sport-icon">${a.icon}</span>
      <h2>${a.name}</h2>
      <p>Karriere-Modus starten</p>
    </div>`).join('');
  const saves = allSaves();
  const savesHtml = saves.length ? `<div class="saves">
    <div class="saves-head">💾 GESPEICHERTE KARRIEREN</div>
    ${saves.map(s => { const a = getAdapter(s.sport); const n = String(s.player.name).replace(/'/g, "\\'"); return `
      <div class="card save-row">
        <span style="font-size:1.5rem">${a?.icon || '🏟️'}</span>
        <div style="flex:1;min-width:0"><div style="font-weight:700">${s.player.name}</div>
          <div style="color:var(--muted);font-size:.8rem">${a?.leagues?.[s.career.leagueIndex] || ''} · Saison ${s.career.season} · ${s.player.position} · Alter ${s.player.age}</div></div>
        <button class="btn btn-primary btn-sm" onclick="App.continueGame('${n}')">Laden</button>
        <button class="btn btn-ghost btn-sm" title="Karriere löschen" onclick="App.confirmDeleteSave('${n}')">🗑️</button>
      </div>`; }).join('')}</div>` : '';
  let hofHtml = '';
  try {
    const hof = JSON.parse(localStorage.getItem('sportsCareer_hallOfFame') || '[]');
    if (hof.length) hofHtml = `<div class="card saves" style="margin-top:12px"><details><summary style="cursor:pointer;font-weight:700">🏆 Hall of Fame (${hof.length})</summary>
      ${hof.map(e => `<div class="save-row" style="padding:6px 0"><span>${getAdapter(e.sport)?.icon || '🏟️'}</span><div style="flex:1"><strong>${e.name}</strong> <span style="color:var(--muted);font-size:.8rem">${e.seasons} Saisons · ${e.goals} ${getAdapter(e.sport)?.scoreLabel || ''} · ${e.bestLeague || ''}</span></div></div>`).join('')}</details></div>`;
  } catch { hofHtml = ''; }
  return `<div class="screen title-screen">
    <h1>🏟️ Sports Career</h1>
    <p class="subtitle">Fussball ⚽ & Basketball 🏀 — Dein Karriere-Simulator</p>
    <div style="margin-bottom:18px"><button class="btn btn-ghost quick-btn" onclick="App.showQuickGame()">⚡ Quick Game — sofort losspielen</button></div>
    <div class="sport-cards">${sportButtons}</div>
    ${savesHtml}${hofHtml}
  </div>`;
}

function _createScreen(cfg) {
  const positions = cfg.positions.map(p =>
    `<button class="pos-btn" type="button" onclick="document.querySelectorAll('.pos-btn').forEach(b=>b.classList.remove('selected'));this.classList.add('selected');this.dataset.pos='${p}'">${p}</button>`
  ).join('');
  return `<div class="screen create-screen">
    <h2>${cfg.icon} ${cfg.name} — Spieler erstellen</h2>
    <div class="card">
      <div class="form-group"><label>Spielername</label>
        <input id="player-name" type="text" placeholder="Dein Name" maxlength="24"></div>
      <div class="form-group"><label>Position</label>
        <div class="position-grid">${positions}</div>
      </div>
      <button class="btn btn-success btn-block" onclick="App.confirmCreate('${cfg.id}')">Karriere starten ⚡</button>
    </div>
    <button class="btn btn-ghost btn-block" onclick="App.showTitle()">← Zurück</button>
  </div>`;
}

function _hubScreen() {
  const p = state.player, c = state.career;
  const cfg = getAdapter(state.sport);
  const league = cfg.leagues[c.leagueIndex] || 'Unbekannt';
  const total = c.wins + c.losses + c.draws;
  const winRate = total > 0 ? Math.round((c.wins / total) * 100) : 0;
  const actions = _actionsScreen();
  const logHtml = (state.log || []).slice(0, 5).map(e => `<div class="log-entry ${e.type}"><span class="log-icon">${e.icon||'📋'}</span><span>${e.msg}</span></div>`).join('');
  return `<div class="screen hub-screen">
    <div class="hud">
      <div class="hud-name">${p.name} <span class="hud-sport ${state.sport}">${cfg.icon} ${cfg.name}</span></div>
      <div class="hud-block"><div class="hud-label">Liga</div><div class="hud-value">${league}</div></div>
      <div class="hud-block"><div class="hud-label">Saison</div><div class="hud-value">${c.season}</div></div>
      <div class="hud-block"><div class="hud-label">Woche</div><div class="hud-value">${c.week}/${c.weeksPerSeason}</div></div>
      <div class="hud-block"><div class="hud-label">Energie</div><div class="hud-value">${p.energy}%</div></div>
      <div class="hud-block"><div class="hud-label">Geld</div><div class="hud-value">€${fmt(p.money)}</div></div>
      ${cfg.career.hudExtras?.(state) || ''}
      ${state._quickGame ? '' : `<button class="btn btn-ghost btn-sm hud-exit" onclick="App.showExitMenu()">⏏️ Beenden</button>`}
    </div>
    ${renderSeasonBar(c)}
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
        <strong>${p.position}</strong>
        <span style="font-size:.8rem;color:var(--muted)">⚡ ${p.skillPoints} Skillpunkte</span>
      </div>
      ${renderStats(p)}
    </div>
    ${actions}
    ${getAdapter(state.sport).career.hubSection(state)}
    <div class="card">
      <div style="font-size:.8rem;color:var(--muted);margin-bottom:8px">LETZTE ERGEBNISSE</div>
      <div class="log">${logHtml || '<div style="color:var(--muted);font-size:.85rem">Noch keine Spiele gespielt.</div>'}</div>
    </div>
    <button class="btn btn-ghost btn-block" style="margin-top:8px" onclick="App.confirmDeleteSave('${String(p.name).replace(/'/g, "\\'")}')">Karriere löschen</button>
  </div>`;
}



function _actionsScreen() {
  const p = state.player, c = state.career, cfg = getAdapter(state.sport);
  const card = cfg.actionCard || { label: 'Spiel starten', icon: cfg.icon, desc: '' };
  const matchLabel = card.label, matchIcon = card.icon;
  return `<div class="actions-grid">
    <div class="action-card" onclick="App.doPlayMatch()">
      <span class="action-icon">${matchIcon}</span>
      <div class="action-name">${matchLabel}</div>
      <div class="action-desc">${card.desc}</div>
      <div class="action-cost">Energie -20–30</div>
    </div>
    <div class="action-card ${p.energy < 20 ? 'disabled' : ''}" onclick="App.doTraining(prompt('Stat (${cfg.stats.join(', ')})?'))">
      <span class="action-icon">💪</span>
      <div class="action-name">Training</div>
      <div class="action-desc">+2–6 Stat-Punkte</div>
      <div class="action-cost">€50 · Energie -10–20</div>
    </div>
    <div class="action-card" onclick="App.doRest()">
      <span class="action-icon">🛋️</span>
      <div class="action-name">Ausruhen</div>
      <div class="action-desc">Energie +25–45, Moral +5–15</div>
      <div class="action-cost">Kostenlos</div>
    </div>
    <div class="action-card" onclick="App.doSimSeason()">
      <span class="action-icon">📅</span>
      <div class="action-name">Saison simulieren</div>
      <div class="action-desc">Rest der Saison automatisch</div>
    </div>
    ${p.skillPoints > 0 ? `
    <div class="action-card" onclick="App.spendSkillPoint(prompt('Stat (${cfg.stats.join(', ')})?'))">
      <span class="action-icon">⭐</span>
      <div class="action-name">Skillpunkt investieren</div>
      <div class="action-desc">+4–8 auf gewählte Stat</div>
      <div class="action-cost">${p.skillPoints} Punkte übrig</div>
    </div>` : ''}
  </div>`;
}

function _matchScreen(result) {
  const cfg = getAdapter(state.sport);
  // A sport may bring its own result screen (basketball's broadcast view)
  const own = cfg.career.matchScreen(state, result);
  if (own) return own;
  const eventsHtml = result.events.map(e => `<div class="match-event ${e.type}">${result.box ? e.minute : e.minute + "'"} — ${e.text}</div>`).join('');

  const boxTable = (title, rows) => `
    <div class="bb-box"><h4>${title}</h4><div class="bb-box-scroll"><table>
      <thead><tr><th>Spieler</th><th>MIN</th><th>PTS</th><th>FG</th><th>3P</th><th>FT</th><th>REB</th><th>AST</th><th>STL</th><th>BLK</th><th>TO</th><th>PF</th><th>+/-</th></tr></thead>
      <tbody>${rows.map(r => `<tr class="${r.human ? 'me' : ''}">
        <td>${r.human ? '★ ' : ''}${r.name} <i>${r.role}</i></td>
        <td>${r.min.toFixed(1)}</td><td><b>${r.pts}</b></td>
        <td>${r.fgm}/${r.fga}</td><td>${r.tpm}/${r.tpa}</td><td>${r.ftm}/${r.fta}</td>
        <td>${r.reb}</td><td>${r.ast}</td><td>${r.stl}</td><td>${r.blk}</td><td>${r.tov}</td><td>${r.pf}</td>
        <td>${r.pm > 0 ? '+' : ''}${r.pm}</td></tr>`).join('')}</tbody></table></div></div>`;
  const boxHtml = result.box
    ? boxTable(state.career.teamName, result.box.home) + boxTable(result.opponent, result.box.away)
    : '';
  const projectedHtml = result.projected
    ? `<p class="projected-note">Gespielt über ${(48 / result.projected.factor).toFixed(0)} Minuten — für Tabelle und Karriere auf 48 Minuten hochgerechnet (${result.projected.score}, ${result.projected.pts} PTS).</p>`
    : '';
  return `<div class="screen match-screen">
    <div class="card">
      <div style="color:var(--muted);font-size:.8rem;margin-bottom:8px">${cfg.icon} ${cfg.name} — Spielbericht</div>
      <div class="match-score">
        <div>
          <div class="match-team">${state.career.teamName}</div>
          <div>${result.score.split(':')[0].trim()}</div>
        </div>
        <div style="font-size:1.5rem;color:var(--muted)">:</div>
        <div>
          <div class="match-team">${result.opponent}</div>
          <div>${result.score.split(':')[1].trim()}</div>
        </div>
      </div>
      <div style="margin:12px 0;font-size:.9rem;color:var(--muted)">
        Ergebnis: <strong style="color:${result.result==='win'?'var(--football)':result.result==='loss'?'var(--danger)':'var(--gold)'}">${result.result==='win'?'Sieg':result.result==='draw'?'Unentschieden':'Niederlage'}</strong>
        · pers. ${result.personal} ${cfg.scoreLabel} · ${result.assists} Assists
      </div>
      ${projectedHtml}
      ${eventsHtml ? `<div class="match-events">${eventsHtml}</div>` : ''}
      ${boxHtml}
      <div style="margin-top:10px;color:var(--gold)">+€${fmt(result.money)} verdient</div>
    </div>
    <button class="btn btn-primary btn-block" onclick="App.${result.backTo || 'showHub'}()">Weiter →</button>
  </div>`;
}


function _footballIntroScreen(s, opponent) {
  return `<div class="screen stadium-screen">
    ${_hubHUD()}
    <div class="card stadium-card">
      <canvas id="stadium-intro-canvas" width="1200" height="675" aria-label="Teams laufen in das Stadion ein"></canvas>
      <div class="stadium-vignette"></div>
      <div class="stadium-title">
        <span>${getAdapter(s.sport).leagues[s.career.leagueIndex]} · SPIELTAG ${s.career.week}</span>
        <div class="stadium-fixture">
          <div><i class="stadium-crest home-crest">${s.career.teamName.charAt(0)}</i><strong>${s.career.teamName}</strong></div>
          <b>VS</b>
          <div><i class="stadium-crest away-crest">${opponent.charAt(0)}</i><strong>${opponent}</strong></div>
        </div>
        <p>Die Mannschaften betreten den Rasen</p>
      </div>
      <div class="stadium-progress"><span id="stadium-progress-bar"></span></div>
      <button class="stadium-skip" type="button" onclick="App.skipStadiumIntro()">Zum Anstoss →</button>
    </div>
  </div>`;
}

function _footballKickoffScreen(s, opponent) {
  return `<div class="screen live-match-screen">
    ${_hubHUD()}
    <div class="card live-match-card">
      <div class="live-scorebar">
        <div><small>HEIM</small><strong>${s.career.teamName}</strong></div>
        <div class="live-score-center">
          <div class="live-score"><span id="live-home-score">0</span><i>:</i><span id="live-away-score">0</span></div>
          <small class="match-mode">11 VS 11 · 3D-KAMERA</small>
        </div>
        <div class="live-away"><small>GAST</small><strong>${opponent}</strong></div>
      </div>
      <div class="live-pitch-wrap">
        <canvas id="football-canvas" width="960" height="540" aria-label="Spielbares 3D-Fussballfeld mit 22 Spielern"></canvas>
        <div class="live-kickoff" id="live-kickoff">
          <span>KARRIERE-SPIEL</span>
          <h2>Bereit für den Anstoss?</h2>
          <p>Ein Match dauert 60 Sekunden.</p>
          <button class="btn btn-success" onclick="App.startFootballMatch()">Anstoss ⚽</button>
        </div>
        <div class="live-message" id="live-message"></div>
        <div class="touch-gamepad" aria-label="Touch-Steuerung">
          <div class="touch-joystick" id="touch-joystick" aria-label="Virtueller Joystick">
            <div class="touch-joystick-ring"></div>
            <div class="touch-joystick-knob" id="touch-joystick-knob"></div>
          </div>
          <div class="touch-actions">
            <button class="touch-sprint" id="touch-sprint">⚡</button>
            <button class="touch-shoot" id="touch-shoot">⚽</button>
          </div>
        </div>
      </div>
      <div class="live-controls">
        <span>Steuerung: WASD/ Pfeiltasten + Leertaste = Schuss, Shift = Sprint</span>
        <button class="btn btn-sm btn-danger" onclick="App.showExitMenu()">⏏️ Verlassen</button>
      </div>
    </div>
  </div>`;
}

function _hubHUD() {
  const p = state.player, c = state.career;
  const cfg = getAdapter(state.sport);
  return `<div class="hud">
    <div class="hud-name">${p.name} <span class="hud-sport ${state.sport}">${cfg.icon}</span></div>
    <div class="hud-block"><div class="hud-label">Liga</div><div class="hud-value">${cfg.leagues[c.leagueIndex]}</div></div>
    <div class="hud-block"><div class="hud-label">Woche</div><div class="hud-value">${c.week}/${c.weeksPerSeason}</div></div>
    <div class="hud-block"><div class="hud-label">Energie</div><div class="hud-value">${p.energy}%</div></div>
    <div class="hud-block"><div class="hud-label">Geld</div><div class="hud-value">€${fmt(p.money)}</div></div>
  </div>`;
}

function _createFootballLineup(team, selectHuman = true) {
  const formation = [
    { x: 105, y: 270, number: 1, role: 'GK', keeper: true },
    { x: 225, y: 100, number: 2, role: 'RB' }, { x: 225, y: 210, number: 4, role: 'CB' },
    { x: 225, y: 330, number: 5, role: 'CB' }, { x: 225, y: 440, number: 3, role: 'LB' },
    { x: 410, y: 150, number: 8, role: 'CM' }, { x: 410, y: 270, number: 10, role: 'CAM' },
    { x: 410, y: 390, number: 6, role: 'CM' },
    { x: 575, y: 125, number: 7, role: 'RW' }, { x: 600, y: 270, number: 9, role: 'ST' },
    { x: 575, y: 415, number: 11, role: 'LW' },
  ];
  return formation.map(def => {
    const x = team === 'home' ? def.x : 960 - def.x;
    return { ...def, x, y: def.y, homeX: x, homeY: def.y, team, r: def.keeper ? 17 : 13, vx: 0, vy: 0,
      human: selectHuman && team === 'home' && def.number === 10, cooldown: 0,
      facing: team === 'home' ? 0 : Math.PI, stride: 0 };
  });
}

function _modal(inner) {
  _closeModal();
  const el = document.createElement('div'); el.className = 'modal-bg'; el.innerHTML = `<div class="modal">${inner}</div>`;
  document.body.appendChild(el);
}
function _closeModal() { document.querySelector('.modal-bg')?.remove(); }
function _stopLiveMatches() {
  if (liveMatch?.raf) cancelAnimationFrame(liveMatch.raf);
  liveMatch?.cleanup?.(); liveMatch = null;
  bb.stopLive?.();
}

function showLoadError(saved) {
  const msg = saved._loadError === 'FUTURE_VERSION'
    ? `Spielstand ist aus einer neueren Version (Schema v${saved.version}). Bitte aktualisiere das Spiel.`
    : saved._loadError === 'CORRUPT_JSON'
    ? 'Spielstand ist beschädigt und konnte nicht geladen werden.'
    : saved._loadError === 'MISSING'
    ? 'Diese Karriere gibt es nicht mehr.'
    : 'Spielstand konnte nicht geladen werden.';
  render(`<div class="screen" style="text-align:center;padding:40px">
    <div class="card"><h2 style="color:var(--danger)">Ladefehler</h2><p style="color:var(--muted);margin:16px 0">${msg}</p>
    <button class="btn btn-primary" onclick="App.doNewGame()">Zum Menü</button></div></div>`);
}

// ── Init ──────────────────────────────────────────────
window.App = App;
App.start();

// ── confirmCreate (appended after App init) ──────────
// This is mixed into App above via the App object
App.confirmCreate = function(sportId) {
  const name = document.getElementById('player-name')?.value?.trim();
  const posBtn = document.querySelector('.pos-btn.selected');
  const position = posBtn?.dataset?.pos;
  if (!name || !position) { alert('Bitte Name und Position eingeben.'); return; }
  const saveSeed = Date.now();
  const rng = createRNG(saveSeed);
  const adapter = getAdapter(sportId);
  state = newState(sportId, name, position, adapter, rng);
  state._saveSeed = saveSeed;
  state._rng = rng;
  // Initialise league-wide rosters for basketball (Epic #51)
  if (sportId === 'basketball' && adapter.initLeagueRoster) {
    adapter.initLeagueRoster(state, rng);
  }
  saveGame(state);
  App.showHub();
};
