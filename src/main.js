// src/main.js — entry point for Sports Career Game
import { createRNG, matchSeed } from './core/rng.js';
import { newState }             from './core/state.js';
import { saveGame, loadGame, clearSave, exportSave, importSave } from './core/persistence.js';
import { avgStat, clamp, fmt }  from './core/utils.js';
import { adapters, getAdapter } from './sports/adapters.js';
import { getLeagueLeaders }    from './sports/basketball/index.js';
import { footballAdapter }   from './sports/football/index.js';
import { basketballAdapter } from './sports/basketball/index.js';
import * as bb                from './sports/basketball/career.js';
import { render, renderStats, renderSeasonBar, statColor } from './ui/dom.js';
import { addLog }               from './ui/log.js';
import { generatePlayByPlay, generateQuarterScores } from './ui/commentary.js';

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
  showMatch(result) { render(_matchScreen(result)); },

  // ── Actions ─────────────────────────────────────────
  doPlayMatch() {
    if (!state) return;
    const adapter = getAdapter(state.sport);
    if (state.sport === 'football') {
      App.showFootballMatch();
    } else if (state.sport === 'basketball') {
      // The season owns the fixture list; the game-day screen offers playing it
      // live, simulating it, or scouting the opponent first.
      bb.ensureSeason(state, basketballAdapter.teamsByLeague);
      const season = state.career.nba;
      if (season.playoffs && season.playoffs.stage !== 'done') bb.showPlayoffs(state, App);
      else bb.showGameDay(state, App);
    }
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
  bbScout() {
    if (!state) return;
    const adapter = getAdapter('basketball');
    const info = bb.nextGameInfo(state);
    if (!info || !adapter.getScoutingInfo) return App.bbGameDay();
    const oppTeamData = state.league?.teams?.[info.opponent.name];
    if (!oppTeamData?.roster) return App.bbGameDay();
    render(_basketballScoutScreen({ opponent: info.opponent.name }, adapter.getScoutingInfo(oppTeamData.roster)));
  },

  doBasketballMatch() {
    if (!state) return;
    const adapter  = getAdapter(state.sport);
    const matchCtx = adapter.createMatch(state);
    const rng      = createRNG(matchCtx.seed);
    const result   = adapter.simulateHeadless(state, { rng, ...matchCtx });
    addLog(state, `Match gegen ${result.opponent}: ${result.score}`, result.result === 'win' ? 'good' : result.result === 'loss' ? 'bad' : 'neutral');
    saveGame(state);
    App.showMatch(result);
  },

  doTraining(stat) {
    const p = state.player, c = state.career;
    if (p.energy < 20) return;
    // A basketball season runs on a calendar: training spends an off day, and on
    // a game day there is none to spend.
    if (state.sport === 'basketball' && !bb.spendRestDay(state, basketballAdapter.teamsByLeague)) {
      addLog(state, 'Spieltag — heute wird gespielt, nicht trainiert.', 'neutral');
      saveGame(state);
      return App.bbGameDay();
    }
    const gain = state._rng.randInt(2, 6);
    p.stats[stat] = clamp(p.stats[stat] + gain, 1, 99);
    p.energy = clamp(p.energy - state._rng.randInt(10, 20), 0, 100);
    p.money -= 50;
    if (state.sport !== 'basketball') { c.week++; if (c.week > c.weeksPerSeason) { App.endSeason(); } }
    addLog(state, `Training: ${stat} +${gain}`, 'good');
    saveGame(state); App.showHub();
  },

  doRest() {
    const p = state.player, c = state.career;
    if (state.sport === 'basketball' && !bb.spendRestDay(state, basketballAdapter.teamsByLeague)) {
      addLog(state, 'Spieltag — heute wird gespielt, nicht ausgeruht.', 'neutral');
      saveGame(state);
      return App.bbGameDay();
    }
    p.energy = clamp(p.energy + state._rng.randInt(25, 45), 0, 100);
    p.morale = clamp(p.morale + state._rng.randInt(5, 15), 0, 100);
    if (state.sport !== 'basketball') { c.week++; if (c.week > c.weeksPerSeason) { App.endSeason(); } }
    addLog(state, `Erholt. Energie +${25}, Moral +${10}`, 'neutral');
    saveGame(state); App.showHub();
  },

  doSimSeason() {
    if (!state) return;
    const adapter = getAdapter(state.sport);
    const results = [];
    const c = state.career;
    const startWeek = c.week;
    for (let w = startWeek; w <= c.weeksPerSeason; w++) {
      const matchCtx = adapter.createMatch(state);
      const rng = createRNG(matchCtx.seed);
      const r = adapter.simulateHeadless(state, { rng, ...matchCtx });
      results.push(r);
    }
    results.forEach(r => {
      addLog(state, `${r.opponent}: ${r.score}`, r.result === 'win' ? 'good' : r.result === 'loss' ? 'bad' : 'neutral');
    });
    saveGame(state); App.showHub();
  },

  doNewGame() { state = null; clearSave(); App.showTitle(); },

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
    const isFootball = state.sport === 'football';
    const PROMOTION = 0.55, RELEGATION = 0.30;
    let promoted = false, relegated = false;
    if (winRate >= PROMOTION && c.leagueIndex < adapter.leagues.length - 1) {
      c.leagueIndex++; c.promotions++; promoted = true;
    } else if (winRate < RELEGATION && c.leagueIndex > 0) {
      c.leagueIndex--; c.relegations++; relegated = true;
    }
    if (promoted) {
      const teams = isFootball ? footballAdapter.teamNames : basketballAdapter.teamsByLeague[c.leagueIndex];
      c.teamName = teams[Math.floor(state._rng.next() * teams.length)];
      addLog(state, `Aufstieg in die ${adapter.leagues[c.leagueIndex]}! 🎉`, 'good');
    } else if (relegated) {
      const teams = isFootball ? footballAdapter.teamNames : basketballAdapter.teamsByLeague[c.leagueIndex];
      c.teamName = teams[Math.floor(state._rng.next() * teams.length)];
      addLog(state, `Abstieg in die ${adapter.leagues[c.leagueIndex]} 😤`, 'bad');
    }
    c.season++; c.week = 1; c.wins = 0; c.losses = 0; c.draws = 0;
    const bonus = isFootball ? state._rng.randInt(2000, 8000) * (c.leagueIndex + 1) : c.leagueIndex === 1 ? state._rng.randInt(1500000, 5000000) : state._rng.randInt(50000, 150000);
    p.money += bonus; p.totalEarned += bonus;
    // Re-init league rosters for the new season (basketball only) (Epic #51)
    if (!isFootball && adapter.initLeagueRoster) {
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
  c.week++;
  if (c.week > c.weeksPerSeason) App.endSeason();
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

function _drawFootballMatch(m) {
  _drawFootballPitch(m.context, 960, 540);
  m.players.slice().sort((a, b) => a.y - b.y).forEach(p => _drawFootballer(m.context, p, p.human));
  _drawFootball(m.context, m.ball);
}

function _drawFootballPitch(ctx, w, h) {
  const sky = ctx.createLinearGradient(0, 0, 0, 160);
  sky.addColorStop(0, '#07131b'); sky.addColorStop(1, '#26383e');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#202a2f'; ctx.fillRect(0, 42, w, 92);
  const crowd = ['#eef1ef', '#dfff53', '#ef5c53', '#4d78e0'];
  for (let row = 0; row < 4; row++) for (let col = 0; col < 80; col++) {
    ctx.fillStyle = crowd[(row * 5 + col * 3) % crowd.length];
    ctx.globalAlpha = 0.52; ctx.beginPath(); ctx.arc(col * 12 + (row % 2) * 5, 61 + row * 17, 2.1, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
  const ground = ctx.createLinearGradient(0, 130, 0, h);
  ground.addColorStop(0, '#1a5c30'); ground.addColorStop(1, '#245c31');
  ctx.fillStyle = ground; ctx.fillRect(0, 130, w, h - 130);
  ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(0, h * 0.63); ctx.lineTo(w, h * 0.63); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 1.5;
  const gx = 960, gy = 205, gw = 80, gh = 130;
  ctx.strokeRect((gx - gw) / 2, gy, gw, gh);
  ctx.strokeRect((gx - gw) / 2 - 55, gy + 30, gw - 20, gh - 60);
  ctx.strokeRect((gx - gw) / 2 + 55, gy + 30, gw - 20, gh - 60);
  ctx.beginPath(); ctx.arc(gx / 2, h * 0.63, 60, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeRect(0, 34, w, h - 68);
  ctx.beginPath(); ctx.moveTo(w / 2, 34); ctx.lineTo(w / 2, h - 34); ctx.stroke();
}

function _drawFootballer(ctx, p, isHuman) {
  ctx.save(); ctx.translate(p.x, p.y);
  ctx.beginPath(); ctx.arc(0, 0, p.r, 0, Math.PI * 2);
  ctx.fillStyle = p.team === 'home' ? (isHuman ? '#dfff53' : '#a8d94a') : '#4267d6';
  ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.fillStyle = '#111'; ctx.font = `bold ${p.r * 0.9}px Segoe UI`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(p.number, 0, 0);
  ctx.restore();
}

function _drawFootball(ctx, b) {
  ctx.save(); ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
  ctx.fillStyle = '#fff'; ctx.fill(); ctx.strokeStyle = '#222'; ctx.lineWidth = 1; ctx.stroke();
  ctx.restore();
}

// ── Screen builders ───────────────────────────────────
function _titleScreen() {
  const sportButtons = adapters.map(a => `
    <div class="sport-card ${a.color}" onclick="App.showCreate('${a.id}')">
      <span class="sport-icon">${a.icon}</span>
      <h2>${a.name}</h2>
      <p>Karriere-Modus starten</p>
    </div>`).join('');
  return `<div class="screen title-screen">
    <h1>🏟️ Sports Career</h1>
    <p class="subtitle">Fussball ⚽ & Basketball 🏀 — Dein Karriere-Simulator</p>
    <div class="sport-cards">${sportButtons}</div>
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
    ${state.sport === 'basketball' ? _basketballLeagueSection() : ''}
    <div class="card">
      <div style="font-size:.8rem;color:var(--muted);margin-bottom:8px">LETZTE ERGEBNISSE</div>
      <div class="log">${logHtml || '<div style="color:var(--muted);font-size:.85rem">Noch keine Spiele gespielt.</div>'}</div>
    </div>
    <button class="btn btn-ghost btn-block" style="margin-top:8px" onclick="if(confirm('Spielstand wirklich löschen?'))App.doNewGame()">Neues Spiel</button>
  </div>`;
}

// ── Basketball-only: Liga leaderboard (Epic #51) ─────────────────────────────
function _basketballLeagueSection() {
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

// ── Basketball: scouting screen (Epic #52) ───────────────────────────────────
function _basketballScoutScreen(matchCtx, scouting) {
  const c = state.career;
  const cfg = getAdapter(state.sport);
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
    <button class="btn btn-primary btn-block" onclick="App.doBasketballMatch()">Spielen 🏀</button>
    <button class="btn btn-ghost btn-block" onclick="App.showHub()">← Zurück</button>
  </div>`;
}

function _actionsScreen() {
  const p = state.player, c = state.career, cfg = getAdapter(state.sport);
  const isFootball = state.sport === 'football';
  const matchLabel = isFootball ? 'Spiel starten' : 'Match simulieren';
  const matchIcon  = isFootball ? '⚽' : '🏀';
  return `<div class="actions-grid">
    <div class="action-card" onclick="App.doPlayMatch()">
      <span class="action-icon">${matchIcon}</span>
      <div class="action-name">${matchLabel}</div>
      <div class="action-desc">${isFootball ? '11 vs 11 im Stadion' : 'Spielergebnis berechnen'}</div>
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
  if (state.sport === 'basketball') return _basketballMatchScreen(result);
  // ── Football (and any future non-basketball sport) — UNCHANGED ──────────
  const cfg = getAdapter(state.sport);
  const isFootball = state.sport === 'football';
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

// ── Basketball broadcast match screen ──────────────────────────────────────
function _basketballMatchScreen(result) {
  const cfg      = getAdapter(state.sport);
  const teamName = state.career.teamName;
  const oppName  = result.opponent;
  const homeTotal = (result.playerGoals || 0) + 50;
  const awayTotal = (result.oppGoals    || 0) + 50;

  // Deterministic display RNG (does NOT advance the game-state RNG)
  const dSeed = ((result.playerGoals || 0) * 2654435761 + (result.oppGoals || 0) * 1013904223 + ((result.money || 0) & 0xffff)) >>> 0;
  const drng  = createRNG(dSeed || 42);

  // Quarter scores — generated ONCE and shared with play-by-play so markers are consistent
  const homeQs = generateQuarterScores(homeTotal, drng);
  const awayQs = generateQuarterScores(awayTotal, drng);

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

  // Box score
  const BFIRST = ['T.','M.','K.','D.','J.','R.','A.','B.','L.','N.'];
  const BLAST  = ['Weber','Müller','Fischer','Schmidt','Koch','Wagner','Bauer','Richter','Klein','Wolf'];
  const usedLast = new Set();
  const genTm = () => {
    let ln; do { ln = BLAST[drng.randInt(0, BLAST.length - 1)]; } while (usedLast.has(ln));
    usedLast.add(ln);
    return { name: `${BFIRST[drng.randInt(0, BFIRST.length - 1)]} ${ln}`, min: drng.randInt(15, 32), pts: drng.randInt(4, 20), ast: drng.randInt(1, 6), reb: drng.randInt(2, 9) };
  };
  const teammates = [genTm(), genTm(), genTm(), genTm()];
  const humanRow  = { name: state.player.name, min: drng.randInt(28, 40), pts: result.personal, ast: result.assists, reb: drng.randInt(2, 10) };

  const OFIRST = ['K.','J.','M.','A.','D.','R.'];
  const OLAST  = ['Johnson','Williams','Brown','Davis','Miller','Wilson'];
  const oppStarName = `${OFIRST[drng.randInt(0, OFIRST.length-1)]} ${OLAST[drng.randInt(0, OLAST.length-1)]}`;
  const oppStar = {
    name: `★ ${oppStarName} (${awayAbbr})`,
    min:  result.result === 'loss' ? drng.randInt(36, 42) : drng.randInt(28, 36),
    pts:  result.result === 'loss' ? drng.randInt(26, 40) : drng.randInt(12, 24),
    ast:  result.result === 'loss' ? drng.randInt(6, 12)  : drng.randInt(2, 7),
    reb:  result.result === 'loss' ? drng.randInt(8, 14)  : drng.randInt(3, 8),
  };

  const mkRow = (p, cls = '') =>
    `<tr${cls ? ` class="${cls}"` : ''}><td>${p.name}</td><td>${p.min}</td><td>${p.pts}</td><td>${p.ast}</td><td>${p.reb}</td></tr>`;

  const boxScoreHtml =
    `<table class="box-score">` +
      `<thead><tr><th>Spieler</th><th>MIN</th><th>PTS</th><th>AST</th><th>REB</th></tr></thead>` +
      `<tbody>` +
        mkRow(humanRow, 'human-row') +
        teammates.map(t => mkRow(t)).join('') +
        `<tr style="opacity:.7">${mkRow(oppStar).replace(/^<tr[^>]*>/, '').replace(/<\/tr>$/, '')}</tr>` +
      `</tbody>` +
    `</table>`;

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
      ${boxScoreHtml}
    </div>
    <button class="btn btn-primary btn-block" onclick="App.showHub()">Weiter →</button>
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
        <button class="btn btn-sm btn-danger" onclick="App.abandonFootballMatch()">Aufgeben</button>
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

function showLoadError(saved) {
  const msg = saved._loadError === 'FUTURE_VERSION'
    ? `Spielstand ist aus einer neueren Version (Schema v${saved.version}). Bitte aktualisiere das Spiel.`
    : saved._loadError === 'CORRUPT_JSON'
    ? 'Spielstand ist beschädigt und konnte nicht geladen werden.'
    : 'Spielstand konnte nicht geladen werden.';
  render(`<div class="screen" style="text-align:center;padding:40px">
    <div class="card"><h2 style="color:var(--danger)">Ladefehler</h2><p style="color:var(--muted);margin:16px 0">${msg}</p>
    <button class="btn btn-primary" onclick="App.doNewGame()">Neu starten</button></div></div>`);
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
