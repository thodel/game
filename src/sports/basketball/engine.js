// =====================================================
//  INTERACTIVE BASKETBALL MATCH ENGINE
//  5-on-5, full court, NBA rules and dimensions.
//  The career mode owns progression; this engine only
//  plays a match and returns a box score.
// =====================================================
import { createRNG } from '../../core/rng.js';

export const BasketballEngine = (() => {
  'use strict';

  // ── Court: real NBA dimensions, in feet ───────────
  const COURT = {
    length: 94, width: 50,
    rim: 5.25,          // rim centre from the baseline
    rimR: 0.75,         // 18" rim
    board: 4,           // backboard from the baseline
    boardW: 6,
    laneW: 16, laneL: 19,
    ftR: 6,             // free-throw circle
    restricted: 4,
    threeR: 23.75,
    cornerOff: 22,      // corner line 3ft from the sideline => 22ft off centre
    centreR: 6,
  };
  // Where the arc meets the straight corner segment
  COURT.cornerX = Math.sqrt(COURT.threeR ** 2 - COURT.cornerOff ** 2); // ~8.95ft from the rim
  const MID = COURT.width / 2;
  const HOOP_L = { x: COURT.rim, y: MID, baseline: 0, dir: 1 };
  const HOOP_R = { x: COURT.length - COURT.rim, y: MID, baseline: COURT.length, dir: -1 };

  // ── Rules ─────────────────────────────────────────
  const RULES = {
    quarters: 4,
    quarterMinutes: 2,   // game minutes per quarter (set at tip-off)
    otMinutes: 1,
    shotClock: 24,
    shotClockOreb: 14,
    timeScale: 2,        // game seconds per real second
    bonusAt: 5,          // team fouls per quarter before the bonus
    foulOut: 6,
    threeSec: 3,
    inbound: 1.2,        // dead-ball pause, in game seconds
  };

  // ── Positions ─────────────────────────────────────
  // handle/three/rim/reb/vision scale the generated ratings and the AI.
  const ROLES = {
    PG: { label: 'Point Guard',    n: 3,  handle: 1.18, three: 1.06, rim: 0.86, reb: 0.50, vision: 1.30, height: 6.2 },
    SG: { label: 'Shooting Guard', n: 12, handle: 1.02, three: 1.18, rim: 0.95, reb: 0.62, vision: 1.00, height: 6.4 },
    SF: { label: 'Small Forward',  n: 7,  handle: 0.95, three: 1.02, rim: 1.06, reb: 0.85, vision: 0.95, height: 6.7 },
    PF: { label: 'Power Forward',  n: 21, handle: 0.80, three: 0.84, rim: 1.14, reb: 1.16, vision: 0.78, height: 6.9 },
    C:  { label: 'Center',         n: 33, handle: 0.68, three: 0.58, rim: 1.28, reb: 1.38, vision: 0.70, height: 7.0 },
  };
  const ORDER = ['PG', 'SG', 'SF', 'PF', 'C'];
  const ROLE_BY_LABEL = Object.fromEntries(ORDER.map(k => [ROLES[k].label, k]));

  // ── Utils ─────────────────────────────────────────
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  // Every random draw in a match comes from one source, injected by the caller
  // (the career derives it from the save seed) so a game can be replayed.
  let R = createRNG(Date.now() >>> 0);
  const random = () => R.next();
  const rnd = (a, b) => a + random() * (b - a);
  const irnd = (a, b) => Math.floor(rnd(a, b + 1));
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const lerp = (a, b, t) => a + (b - a) * t;
  const pick = arr => arr[irnd(0, arr.length - 1)];

  let M = null; // live match state

  // ── Roster generation ─────────────────────────────
  function ratingsFor(role, strength) {
    const r = ROLES[role];
    const base = v => clamp(Math.round(v + rnd(-6, 6)), 15, 99);
    return {
      speed:   base(strength * (role === 'C' ? 0.88 : role === 'PF' ? 0.94 : 1.06)),
      handle:  base(strength * r.handle),
      three:   base(strength * r.three),
      defense: base(strength * (role === 'C' || role === 'PF' ? 1.08 : 0.96)),
      rim:     base(strength * r.rim),
      iq:      base(strength * (role === 'PG' ? 1.12 : 0.98)),
      reb:     base(strength * r.reb * 1.15),
      ft:      base(strength * (role === 'C' ? 0.82 : 1.05)),
    };
  }

  function makePlayer(side, role, name, number, ratings, human) {
    return {
      side, role, name, number, ratings, human: !!human,
      x: 0, y: 0, vx: 0, vy: 0, facing: 0, stride: 0, stamina: 1, cutUntil: 0,
      r: 0.95 + ROLES[role].height * 0.055,   // body radius in feet, taller = wider
      maxSpeed: 15.5 + ratings.speed / 100 * 6.5, // ft per game-second, sprinting
      slowed: 0, jump: 0, cooldown: 0, paint: 0, fouls: 0, out: false,
      starter: false, onCourt: false, satAt: 0, benchedFor: 0, stintStart: 0,
      // Conditioning: how fast the tank empties; speed is the closest thing to it
      conditioning: 0.85 + ratings.speed / 400,
      catchAt: -99, dribbleFrom: null,
      box: { min: 0, pts: 0, fgm: 0, fga: 0, tpm: 0, tpa: 0, ftm: 0, fta: 0,
             oreb: 0, dreb: 0, ast: 0, stl: 0, blk: 0, tov: 0, pf: 0, pm: 0 },
    };
  }

  // Ten men: five starters and a bench one tier below them. `players` is the
  // five on the court — every loop in the engine runs over it — and `roster`
  // is everyone, so a substitution is a swap of objects at a dead ball.
  function makeTeam(side, teamName, strength, humanSpec) {
    const starters = [], bench = [];
    const humanRole = humanSpec ? (ROLE_BY_LABEL[humanSpec.position] || 'SF') : null;
    ORDER.forEach(role => {
      const p = (humanSpec && role === humanRole)
        ? makePlayer(side, role, humanSpec.name, humanSpec.number || ROLES[role].n, humanSpec.ratings, true)
        : makePlayer(side, role, `${pick(FIRST)}. ${pick(LAST)}`, ROLES[role].n + irnd(0, 9), ratingsFor(role, strength));
      p.starter = true; p.onCourt = true; p.stintStart = 0; starters.push(p);
      const b = makePlayer(side, role, `${pick(FIRST)}. ${pick(LAST)}`, ROLES[role].n + 20 + irnd(0, 9), ratingsFor(role, strength - 8));
      bench.push(b);
    });
    return { side, name: teamName, players: starters, roster: [...starters, ...bench], fouls: 0, score: 0, strength, timeouts: 7 };
  }

  const FIRST = ['J', 'D', 'A', 'M', 'T', 'K', 'C', 'R', 'L', 'B', 'S', 'N'];
  const LAST = ['Harper', 'Nowak', 'Silva', 'Okafor', 'Beran', 'Lindqvist', 'Duval', 'Moreau', 'Vasquez', 'Kelly',
                'Ibrahim', 'Petrov', 'Grant', 'Baumann', 'Kovac', 'Mensah', 'Nakamura', 'Rossi', 'Sorensen', 'Wu'];

  // ── Geometry helpers ──────────────────────────────
  // Teams change ends at half time, as they do in a real game.
  function attackHoop(side) {
    const swapped = M.quarter >= 3;
    const right = side === 'home' ? !swapped : swapped;
    return right ? HOOP_R : HOOP_L;
  }
  function defendHoop(side) { return attackHoop(side) === HOOP_R ? HOOP_L : HOOP_R; }
  const other = side => (side === 'home' ? 'away' : 'home');

  function isThree(pt, hoop) {
    const fromBaseline = Math.abs(pt.x - hoop.baseline);
    if (Math.abs(pt.y - MID) >= COURT.cornerOff) {
      // Corner: the line is straight until the arc picks up
      return fromBaseline <= COURT.rim + COURT.cornerX;
    }
    return dist(pt, hoop) >= COURT.threeR;
  }
  const shotValue = (pt, hoop) => (isThree(pt, hoop) ? 3 : 2);

  function inPaint(p, hoop) {
    const fromBaseline = Math.abs(p.x - hoop.baseline);
    return fromBaseline <= COURT.laneL && Math.abs(p.y - MID) <= COURT.laneW / 2;
  }

  // ── Offensive spots (4-out, 1-in) ─────────────────
  function spotsFor(side) {
    const h = attackHoop(side), d = h.dir; // d points from the hoop into the court
    return {
      PG: { x: h.x + d * 26, y: MID },
      SG: { x: h.x + d * 20, y: MID - 15 },
      SF: { x: h.x + d * 20, y: MID + 15 },
      PF: { x: h.x + d * 3,  y: MID + 21 },   // weak-side corner
      C:  { x: h.x + d * 7,  y: MID - 9.6 },  // on the block, outside the lane line
    };
  }

  // ── Match setup ───────────────────────────────────
  function resetPositions(offSide, { tip = false } = {}) {
    const off = M[offSide], def = M[other(offSide)];
    const spots = spotsFor(offSide);
    off.players.forEach(p => {
      const s = spots[p.role];
      p.x = s.x; p.y = s.y; p.vx = p.vy = 0; p.paint = 0;
    });
    const dh = defendHoop(def.side);
    def.players.forEach(p => {
      const man = off.players.find(o => o.role === p.role) || off.players[0];
      const t = towards(man, dh, 4.5);
      p.x = t.x; p.y = t.y; p.vx = p.vy = 0; p.paint = 0;
    });
    if (tip) {
      off.players.forEach(p => { p.x = lerp(p.x, COURT.length / 2, 0.35); });
      def.players.forEach(p => { p.x = lerp(p.x, COURT.length / 2, 0.35); });
    }
    const handler = off.players.find(p => p.role === 'PG') || off.players[0];
    M.ball = { x: handler.x, y: handler.y, z: 0, vx: 0, vy: 0, holder: handler, state: 'held', shot: null };
    handler.catchAt = M.gameTime;
    handler.dribbleFrom = { x: handler.x, y: handler.y };
    M.possession = offSide;
    M.lastPass = null;
  }

  // A point `gap` feet from `p` on the line toward `target`
  function towards(p, target, gap) {
    const d = Math.hypot(target.x - p.x, target.y - p.y) || 1;
    return { x: p.x + (target.x - p.x) / d * gap, y: p.y + (target.y - p.y) / d * gap };
  }

  function start(opts) {
    R = opts.rng || createRNG(Date.now() >>> 0);
    const canvas = document.getElementById(opts.canvasId);
    if (!canvas) return;
    RULES.quarterMinutes = opts.quarterMinutes || RULES.quarterMinutes;

    const home = makeTeam('home', opts.home.name, opts.home.strength, opts.human);
    const away = makeTeam('away', opts.away.name, opts.away.strength, null);

    M = {
      opts, canvas, ctx: canvas.getContext('2d'),
      home, away,
      players: [...home.players, ...away.players],
      human: home.players.find(p => p.human),
      quarter: 1,
      clock: RULES.quarterMinutes * 60,
      shotClock: RULES.shotClock,
      gameTime: 0,
      phase: 'live',
      deadUntil: 0,
      ft: null,
      ball: null,
      possession: 'home',
      events: [],
      keys: new Set(),
      autoHuman: !!opts.autoHuman,
      touch: { x: 0, y: 0, sprint: false, pointerId: null },
      charge: null,
      raf: null, last: performance.now(), cleanup: null,
      message: '',
    };
    // Tired legs shoot worse and run slower; the second night of a back-to-back starts lower
    M.human.stamina = clamp((0.80 + (opts.human.energy ?? 100) / 500) * (opts.backToBack ? 0.85 : 1), 0.5, 1);
    M.noRotations = !!opts.noRotations;      // tests: measure fatigue with nobody resting
    M.noFatigue = !!opts.noFatigue;          // tests: isolate the fatigue effect
    M.stats = { passes: 0, deflect: 0 };
    M.quarterShooting = { home: [], away: [] };

    // Scale: pixels per foot, court centred on the canvas
    M.S = Math.min((canvas.width - 28) / COURT.length, (canvas.height - 28) / COURT.width);
    M.ox = (canvas.width - COURT.length * M.S) / 2;
    M.oy = (canvas.height - COURT.width * M.S) / 2;

    resetPositions(random() < 0.5 ? 'home' : 'away', { tip: true });
    say(`Sprungball — ${M[M.possession].name} hat den Ball`, 'neutral');
    bindInput();
    syncScoreboard();
    M.raf = requestAnimationFrame(frame);
  }

  function abort() {
    if (!M) return;
    if (M.raf) cancelAnimationFrame(M.raf);
    M.cleanup?.();
    M = null;
  }
  const isRunning = () => !!M && M.phase !== 'finished';

  // ── Input ─────────────────────────────────────────
  const MOVE_KEYS = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];

  function bindInput() {
    const down = e => {
      if (!M) return;
      if ([...MOVE_KEYS, 'Space', 'KeyE', 'KeyQ'].includes(e.code)) e.preventDefault();
      if (e.repeat) return;
      M.keys.add(e.code);
      if (e.code === 'Space') pressShoot();
      if (e.code === 'KeyE') pressPass();
      if (e.code === 'KeyQ') pressSteal();
    };
    const up = e => {
      if (!M) return;
      M.keys.delete(e.code);
      if (e.code === 'Space') releaseShoot();
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    const untouch = bindTouch();
    M.cleanup = () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      untouch();
    };
  }

  function bindTouch() {
    const stick = document.getElementById('bb-stick');
    const knob = document.getElementById('bb-knob');
    const btnShoot = document.getElementById('bb-shoot');
    const btnPass = document.getElementById('bb-pass');
    const btnSprint = document.getElementById('bb-sprint');
    if (!stick || !knob) return () => {};
    const move = e => {
      if (!M || M.touch.pointerId !== e.pointerId) return;
      e.preventDefault();
      const b = stick.getBoundingClientRect();
      const max = b.width * 0.31;
      const dx = e.clientX - (b.left + b.width / 2), dy = e.clientY - (b.top + b.height / 2);
      const d = Math.hypot(dx, dy) || 1, s = Math.min(1, max / d);
      M.touch.x = dx * s / max; M.touch.y = dy * s / max;
      knob.style.transform = `translate(${dx * s}px,${dy * s}px)`;
    };
    const startStick = e => { e.preventDefault(); M.touch.pointerId = e.pointerId; stick.setPointerCapture(e.pointerId); move(e); };
    const endStick = e => {
      if (!M || M.touch.pointerId !== e.pointerId) return;
      M.touch.pointerId = null; M.touch.x = M.touch.y = 0; knob.style.transform = 'translate(0,0)';
    };
    const shootDown = e => { e.preventDefault(); btnShoot.classList.add('pressed'); pressShoot(); };
    const shootUp = e => { e.preventDefault(); btnShoot.classList.remove('pressed'); releaseShoot(); };
    const passHit = e => { e.preventDefault(); btnPass.classList.add('pressed'); pressPass(); pressSteal(); setTimeout(() => btnPass.classList.remove('pressed'), 120); };
    const sprintOn = e => { e.preventDefault(); M.touch.sprint = true; btnSprint.classList.add('pressed'); };
    const sprintOff = () => { if (M) M.touch.sprint = false; btnSprint.classList.remove('pressed'); };
    stick.addEventListener('pointerdown', startStick);
    stick.addEventListener('pointermove', move);
    stick.addEventListener('pointerup', endStick);
    stick.addEventListener('pointercancel', endStick);
    btnShoot.addEventListener('pointerdown', shootDown);
    btnShoot.addEventListener('pointerup', shootUp);
    btnShoot.addEventListener('pointercancel', shootUp);
    btnPass.addEventListener('pointerdown', passHit);
    btnSprint.addEventListener('pointerdown', sprintOn);
    btnSprint.addEventListener('pointerup', sprintOff);
    btnSprint.addEventListener('pointercancel', sprintOff);
    return () => {
      stick.removeEventListener('pointerdown', startStick);
      stick.removeEventListener('pointermove', move);
      stick.removeEventListener('pointerup', endStick);
      stick.removeEventListener('pointercancel', endStick);
      btnShoot.removeEventListener('pointerdown', shootDown);
      btnShoot.removeEventListener('pointerup', shootUp);
      btnShoot.removeEventListener('pointercancel', shootUp);
      btnPass.removeEventListener('pointerdown', passHit);
      btnSprint.removeEventListener('pointerdown', sprintOn);
      btnSprint.removeEventListener('pointerup', sprintOff);
      btnSprint.removeEventListener('pointercancel', sprintOff);
    };
  }

  // Space: on offence charge the shot, on defence jump to contest.
  function pressShoot() {
    if (!M) return;
    if (M.phase === 'freethrow') return ftPress();
    if (M.phase !== 'live') return;
    const h = M.human;
    if (!h.onCourt) return;
    if (M.ball.holder === h) M.charge = { t: 0 };
    else if (h.jump <= 0) h.jump = 0.55;
  }
  function releaseShoot() {
    if (!M || M.phase !== 'live' || !M.charge) return;
    const c = M.charge; M.charge = null;
    if (M.ball.holder === M.human) attemptShot(M.human, shotTiming(c.t));
  }
  // A release near the top of the meter is the clean one.
  function shotTiming(t) {
    const off = Math.abs(t - 0.62);
    if (off < 0.06) return 0.09;
    if (off < 0.14) return 0.04;
    if (off < 0.26) return -0.02;
    return -0.10;
  }
  function pressPass() {
    if (!M || M.phase !== 'live') return;
    const h = M.human;
    if (!h.onCourt) return;
    if (M.ball.holder === h) { const t = bestPass(h); if (t?.player) passTo(h, t.player); }
    else M.callForBall = M.gameTime; // teammates favour you for a moment
  }
  function pressSteal() {
    if (!M || M.phase !== 'live') return;
    const h = M.human;
    if (!h.onCourt) return;
    if (M.ball.holder && M.ball.holder.side !== h.side && dist(h, M.ball.holder) < 4 && h.cooldown <= 0) {
      h.cooldown = 0.9;
      const handler = M.ball.holder;
      const p = 0.16 + (h.ratings.defense - handler.ratings.handle) / 420;
      if (random() < clamp(p, 0.03, 0.35)) {
        h.box.stl++; handler.box.tov++;
        say(`${h.name} klaut den Ball!`, h.side === 'home' ? 'player' : 'opponent');
        giveBall(h);
      } else if (random() < 0.22) {
        foul(h, handler, false);
      }
    }
  }

  // ── Loop ──────────────────────────────────────────
  function frame(now) {
    if (!M || M.phase === 'finished') return;
    const real = Math.min(0.05, Math.max(0, (now - M.last) / 1000));
    M.last = now;
    // Integrate in small fixed steps so a long frame cannot let the ball skip past a player
    let remaining = real * RULES.timeScale * (M.fastForward ? 5 : 1);
    while (remaining > 0.0001 && M && M.phase !== 'finished') {
      const step = Math.min(0.033, remaining);
      update(step);
      remaining -= step;
    }
    if (!M || M.phase === 'finished') return;
    draw();
    if (M && M.phase !== 'finished') M.raf = requestAnimationFrame(frame);
  }

  // Fatigue (#49): the tank empties with distance and sprinting, refills on the
  // bench and a little during stoppages. A starter at a normal tempo lasts about
  // nine minutes before a coach would look to the bench.
  // 12-minute quarters are the reference; a 4-minute game tires and rotates three times as fast
  const pace = () => 12 / Math.max(1, RULES.quarterMinutes);

  function tickStamina(dt, stoppage) {
    const k = pace();
    ['home', 'away'].forEach(side => {
      M[side].roster.forEach(p => {
        if (p.out) return;
        if (p.onCourt) {
          if (stoppage) p.stamina = Math.min(1, p.stamina + 0.0008 * dt * k);
          else if (!M.noFatigue) {
            const frac = Math.min(1, Math.hypot(p.vx, p.vy) / Math.max(1, p.maxSpeed));
            p.stamina = Math.max(0.15, p.stamina - (0.0005 + frac * 0.0014) * dt * k / p.conditioning);
          }
        } else {
          p.stamina = Math.min(1, p.stamina + 0.0017 * dt * k);
          p.benchedFor += dt;
        }
      });
    });
  }
  const fatigueSpeed = p => 0.6 + 0.4 * (p.stamina ?? 1);

  function update(dt) {
    if (M.phase === 'dead') {
      M.deadUntil -= dt;
      tickStamina(dt, true);
      if (M.deadUntil <= 0) { M.phase = 'live'; }
      movePlayers(dt, true);
      return;
    }
    if (M.phase === 'freethrow') { tickStamina(dt, true); updateFreeThrow(dt); movePlayers(dt, true); return; }
    if (M.phase !== 'live') return;

    M.gameTime += dt;
    M.clock -= dt;
    M.shotClock -= dt;
    M.players.forEach(p => { p.box.min += dt / 60; });
    tickStamina(dt, false);
    if (M.charge) M.charge.t = Math.min(1.15, M.charge.t + dt * 1.05);
    if (M.charge && M.charge.t >= 1.15) releaseShoot();

    if (M.clock <= 0) { M.clock = 0; return endPeriod(); }
    if (M.shotClock <= 0 && M.ball.state !== 'shot') {
      say('24-Sekunden-Verstoss', M.possession === 'home' ? 'opponent' : 'player');
      if (M.ball.holder) M.ball.holder.box.tov++;
      return turnover(other(M.possession));
    }

    decide(dt);
    movePlayers(dt, false);
    updateBall(dt);
    syncScoreboard();
  }

  // ── Movement ──────────────────────────────────────
  const ACCEL = 52; // ft per game-second²

  function movePlayers(dt, idle) {
    const h = M.human;
    if (!idle && !M.autoHuman && !h.benched && h.onCourt) humanSteer(h, dt);
    M.players.forEach(p => {
      p.cooldown = Math.max(0, p.cooldown - dt);
      p.jump = Math.max(0, p.jump - dt);
      p.slowed = Math.max(0, p.slowed - dt);
      if (idle) { p.vx *= 0.86; p.vy *= 0.86; }
      // separation, so bodies do not stack
      M.players.forEach(q => {
        if (q === p) return;
        const d = dist(p, q);
        if (d < p.r + q.r && d > 0.001) {
          const push = (p.r + q.r - d) / 2;
          p.x += (p.x - q.x) / d * push; p.y += (p.y - q.y) / d * push;
        }
      });
      const sp = Math.hypot(p.vx, p.vy);
      if (sp > 4) { p.facing = Math.atan2(p.vy, p.vx); p.stride += dt * sp * 0.9; }
      p.x = clamp(p.x + p.vx * dt, p.r, COURT.length - p.r);
      p.y = clamp(p.y + p.vy * dt, p.r, COURT.width - p.r);
      // three in the key
      const off = p.side === M.possession;
      if (M.phase !== 'live') { p.paint = 0; return; }
      if (off && inPaint(p, attackHoop(p.side)) && M.ball.state !== 'shot') {
        p.paint += dt;
        if (p.paint > RULES.threeSec) {
          say(`3 Sekunden — ${p.name}`, p.side === 'home' ? 'opponent' : 'player');
          p.box.tov++; p.paint = 0; turnover(other(p.side));
        }
      } else p.paint = 0;
    });
  }

  function humanSteer(h, dt) {
    const k = M.keys;
    let dx = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0);
    let dy = (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0) - (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0);
    if (Math.hypot(M.touch.x, M.touch.y) > 0.08) { dx = M.touch.x; dy = M.touch.y; }
    const len = Math.hypot(dx, dy);
    const sprint = k.has('ShiftLeft') || k.has('ShiftRight') || M.touch.sprint;
    let top = h.maxSpeed * (sprint ? 1 : 0.7) * (h.slowed > 0 ? 0.55 : 1) * fatigueSpeed(h);
    if (M.ball.holder === h) top *= 0.9;      // dribbling costs a little pace
    if (M.charge) top *= 0.45;                 // gathering for the shot
    const tvx = len > 0.05 ? dx / len * top : 0, tvy = len > 0.05 ? dy / len * top : 0;
    approach(h, tvx, tvy, dt, len > 0.05 ? 1 : 1.6);
  }

  function approach(p, tvx, tvy, dt, brake = 1) {
    const ax = clamp(tvx - p.vx, -ACCEL * dt * brake, ACCEL * dt * brake);
    const ay = clamp(tvy - p.vy, -ACCEL * dt * brake, ACCEL * dt * brake);
    p.vx += ax; p.vy += ay;
  }

  function steer(p, target, frac, dt) {
    const top = p.maxSpeed * frac * (p.slowed > 0 ? 0.55 : 1) * fatigueSpeed(p);
    const d = Math.hypot(target.x - p.x, target.y - p.y);
    if (d < 0.4) return approach(p, 0, 0, dt, 1.6);
    const ease = d < 3 ? d / 3 : 1;
    approach(p, (target.x - p.x) / d * top * ease, (target.y - p.y) / d * top * ease, dt);
  }

  const nearestOpp = p => M.players
    .filter(q => q.side !== p.side)
    .reduce((a, b) => (dist(a, p) < dist(b, p) ? a : b));

  // ── Decision making ───────────────────────────────
  function decide(dt) {
    const off = M[M.possession], def = M[other(M.possession)];
    const spots = spotsFor(off.side);
    const hoop = attackHoop(off.side);
    const holder = M.ball.holder;

    off.players.forEach(p => {
      if (p.human && !M.autoHuman) return;
      if (p === holder) return handlerAI(p, dt);
      // Off-ball: hold the spot, crash the glass while a shot is up, cut now and then
      if (M.ball.state === 'shot') return steer(p, reboundSpot(p, hoop), 0.95, dt);
      const spot = spots[p.role];
      if (p.paint > 1.7) {
        const out = { x: p.x, y: p.y + (p.y > MID ? 4 : -4) };
        return steer(p, out, 0.8, dt);
      }
      const cut = p.cutUntil > M.gameTime;
      if (!cut && p.role !== 'C' && random() < dt * 0.12) {
        const mark = nearestOpp(p);
        if (dist(p, mark) > 7 && random() < p.ratings.iq / 260) p.cutUntil = M.gameTime + 1.4;
      }
      steer(p, cut ? hoop : { x: spot.x + Math.sin(M.gameTime * 0.6 + p.number) * 1.6, y: spot.y + Math.cos(M.gameTime * 0.5 + p.number) * 1.6 }, cut ? 0.95 : 0.6, dt);
    });

    // Defence: man-to-man with rim help
    const dh = defendHoop(def.side);
    const driving = holder && dist(holder, attackHoop(holder.side)) < 14;
    def.players.forEach(p => {
      if (p.human && !M.autoHuman) return;
      if (M.ball.state === 'shot') return steer(p, reboundSpot(p, dh), 0.95, dt);
      const man = off.players.find(o => o.role === p.role) || off.players[0];
      let target;
      if (man === holder) {
        target = towards(man, dh, 3.2 + (1 - p.stamina) * 1.6);   // tired closeouts are loose
        if (dist(p, man) < 4 && man.human && random() < dt * 0.5) p.jump = Math.max(p.jump, 0.0);
      } else {
        const gap = 4 + clamp(dist(man, M.ball) / 4.5, 0, 5);
        target = towards(man, dh, gap);
        if (driving && dist(man, M.ball) > 14) {
          const help = towards(holder, dh, 5);
          target = { x: lerp(target.x, help.x, 0.4), y: lerp(target.y, help.y, 0.4) };
        }
      }
      steer(p, target, 0.92, dt);
      // contest: jump when a shot is likely right next to you
      const rimAttack = holder && dist(holder, dh) < 10;
      if (holder && dist(p, holder) < 4.2 && p.jump <= 0 && random() < dt * (rimAttack ? 2.2 : 0.9)) p.jump = 0.5;
    });
  }

  function reboundSpot(p, hoop) {
    const want = M.ball.shot?.carom;
    const eager = 0.35 + p.ratings.reb / 200;
    if (!want) return towards(hoop, p, 6);
    return { x: lerp(p.x, want.x, eager), y: lerp(p.y, want.y, eager) };
  }

  function handlerAI(p, dt) {
    p.think = (p.think || 0) - dt;
    const hoop = attackHoop(p.side);
    const def = nearestOpp(p);
    const dd = dist(p, def);
    const d = dist(p, hoop);

    if (p.think <= 0) {
      p.think = 0.22;
      const q = shotQuality(p, def, { forDecision: true });
      const val = shotValue(p, hoop);
      const ev = q * val;
      // Standards drop as the shot clock runs down, the way they do in a real possession
      const urgency = clamp(1 - M.shotClock / RULES.shotClock, 0, 1);
      // A player who has taken far more than his share holds a higher standard
      const teamShots = M[p.side].players.reduce((a, q) => a + q.box.fga, 0);
      const share = teamShots > 12 ? p.box.fga / teamShots : 0.2;
      const hog = Math.max(0, share - 0.27) * 2.2;
      const desperate = M.shotClock < 3.0;
      // A good look inside is worth taking even when a three grades higher on paper
      const inside = d < 8 && q > 0.47 + hog * 0.5 && dd > 1.8;
      // One threshold for both shot types: the question is only whether this
      // look beats what another possession of ball movement would produce.
      const bar = 1.16 - Math.pow(urgency, 1.7) * 0.46 + hog;
      const settled = ev > bar && dd > 3.6 - urgency * 2.4;
      if (desperate || inside || settled) return attemptShot(p, 0, desperate ? 'desperate' : inside ? 'inside' : 'settled');
      const held = M.gameTime - (p.catchAt || 0);
      const mate = M.shotClock > 4 && held > 0.7 ? bestPass(p) : null;
      if (mate && mate.ev > ev + Math.max(0.02, 0.16 - held * 0.03) + urgency * 0.25) return passTo(p, mate.player);
      // drive if the lane is not walled off
      const lane = towards(p, hoop, Math.min(d, 12));
      const clogged = M.players.filter(x => x.side !== p.side && x !== def && dist(x, lane) < 4.2).length > 1;
      const edge = (p.ratings.handle + p.ratings.speed) / 2 - def.ratings.defense;
      p.driving = !clogged && d > 5 && (dd > 6 || edge > 5);
    }

    if (p.driving && d > 4.5) {
      const help = M.players.filter(x => x.side !== p.side && dist(x, p) < 6.5).length;
      if (help >= 2 && M.shotClock > 3.5) {
        const kick = bestPass(p);
        if (kick && kick.ev > 0.85) { p.driving = false; return passTo(p, kick.player); }
      }
      return steer(p, hoop, 1, dt);
    }
    if (dd < 3.5) {
      // back away from pressure, toward the perimeter
      const away = { x: p.x + (p.x - def.x), y: clamp(p.y + (p.y - def.y), 4, COURT.width - 4) };
      return steer(p, away, 0.75, dt);
    }
    steer(p, { x: lerp(p.x, hoop.x, 0.15), y: p.y + Math.sin(M.gameTime) * 2 }, 0.55, dt);
  }

  function bestPass(p) {
    const hoop = attackHoop(p.side);
    let best = null;
    M[p.side].players.forEach(t => {
      if (t === p) return;
      const opp = nearestOpp(t);
      const open = dist(t, opp);
      const lane = passLaneRisk(p, t);
      let ev = shotQuality(t, opp, { forDecision: true }) * shotValue(t, hoop) - lane * 1.4;
      if (t.human && M.callForBall && M.gameTime - M.callForBall < 1.5) ev += 0.35;
      const teamShots = M[p.side].players.reduce((a, q) => a + q.box.fga, 0);
      if (teamShots > 12) ev += clamp((0.24 - t.box.fga / teamShots) * 0.9, -0.12, 0.14);
      if (dist(p, t) > 40) ev -= 0.25;
      if (!best || ev > best.ev) best = { player: t, ev };
    });
    return best;
  }

  // How exposed a pass is: the closest defender to the passing line
  function passLaneRisk(from, to) {
    let risk = 0;
    M.players.filter(q => q.side !== from.side).forEach(q => {
      const dx = to.x - from.x, dy = to.y - from.y;
      const len2 = dx * dx + dy * dy || 1;
      const t = clamp(((q.x - from.x) * dx + (q.y - from.y) * dy) / len2, 0, 1);
      const px = from.x + dx * t, py = from.y + dy * t;
      const d = Math.hypot(q.x - px, q.y - py);
      if (d < 3.5) risk = Math.max(risk, (3.5 - d) / 3.5 * 0.5);
    });
    return risk;
  }

  function passTo(from, to) {
    if (M.ball.holder !== from) return;
    const d = dist(from, to) || 1;
    const speed = 42 + from.ratings.iq / 10;
    // Errant pass: long or contested feeds sail on you
    const risk = clamp(0.0015 + passLaneRisk(from, to) * 0.016 + d / 9000 + (85 - from.ratings.iq) / 14000, 0, 0.03);
    const target = random() < risk
      ? { x: clamp(to.x + rnd(-9, 9), -3, COURT.length + 3), y: clamp(to.y + rnd(-9, 9), -3, COURT.width + 3) }
      : to;
    M.stats.passes++;
    M.ball.state = 'pass';
    M.ball.holder = null;
    M.ball.from = from;
    M.ball.target = target;
    M.ball.intended = to;
    M.ball.errant = target !== to;
    M.ball.seen = new Set();
    M.ball.speed = speed;
    M.ball.x = from.x; M.ball.y = from.y; M.ball.z = 4.2;
    from.cooldown = 0.25;
  }

  function giveBall(p, { keepClock = false, oreb = false } = {}) {
    const flip = M.possession !== p.side;
    M.ball = { x: p.x, y: p.y, z: 0, vx: 0, vy: 0, holder: p, state: 'held', shot: null };
    p.catchAt = M.gameTime;
    p.dribbleFrom = { x: p.x, y: p.y };
    p.paint = 0;
    if (flip) { M.possession = p.side; M.shotClock = RULES.shotClock; M.lastPass = null; }
    else if (oreb) M.shotClock = Math.max(M.shotClock, RULES.shotClockOreb);
    else if (!keepClock) M.shotClock = M.shotClock;
  }

  // ── Ball ──────────────────────────────────────────
  function updateBall(dt) {
    const b = M.ball;
    if (b.state === 'held') {
      const p = b.holder;
      // Contact on the way to the rim
      const rim = attackHoop(p.side);
      if (dist(p, rim) < 11 && Math.hypot(p.vx, p.vy) > p.maxSpeed * 0.4) {
        for (const q of M.players) {
          if (q.side === p.side || dist(q, p) > 2.2 || q.cooldown > 0) continue;
          if (random() < 0.40 * dt) { q.cooldown = 1.2; foul(q, p, 0, false); return; }
        }
      }
      const bob = Math.sin(M.gameTime * 9) * 0.5;
      b.x = p.x + Math.cos(p.facing) * (p.r + 0.6);
      b.y = p.y + Math.sin(p.facing) * (p.r + 0.6);
      b.z = 1.2 + bob;
      // pressure: strip attempts from close defenders
      M.players.forEach(q => {
        if (M.ball.holder !== p) return;
        if (q.side === p.side || dist(q, p) > 2.4 || q.cooldown > 0) return;
        const chance = 0.015 * (q.ratings.defense / 100) * (1 - p.ratings.handle / 190) * dt;
        if (random() < chance) {
          q.cooldown = 1.1; q.box.stl++; p.box.tov++;
          say(`Ballverlust — ${q.name} greift zu`, q.side === 'home' ? 'player' : 'opponent');
          giveBall(q);
        }
      });
      return;
    }

    if (b.state === 'pass') {
      const t = b.target;
      const d = Math.hypot(t.x - b.x, t.y - b.y) || 1;
      const step = b.speed * dt;
      b.z = lerp(b.z, 3.4, 0.2);
      if (step >= d) {
        b.x = t.x; b.y = t.y;
        // The intended receiver gets first claim; anyone else has to be closest
        const reach = q => dist(q, b) < q.r + 2.2;
        const catcher = (!b.errant && b.intended && dist(b.intended, b) < b.intended.r + 3)
          ? b.intended
          : M.players.filter(reach).sort((x, y) => dist(x, b) - dist(y, b))[0];
        if (!catcher) {
          b.from.box.tov++;
          say(`Fehlpass ${b.from.name}`, b.from.side === 'home' ? 'opponent' : 'player');
          b.state = 'loose'; b.lastTouch = b.from.side; b.z = 2;
          b.vx = rnd(-10, 10); b.vy = rnd(-10, 10);
          return;
        }
        if (catcher.side !== b.from.side) {
          catcher.box.stl++; b.from.box.tov++;
          say(`${catcher.name} fängt den Pass ab`, catcher.side === 'home' ? 'player' : 'opponent');
          return giveBall(catcher);
        }
        return catchBall(catcher);
      }
      b.x += (t.x - b.x) / d * step;
      b.y += (t.y - b.y) / d * step;
      // Deflection in a crowded lane, checked once per defender per pass
      b.seen = b.seen || new Set();
      for (const q of M.players) {
        if (q.side === b.from.side || b.seen.has(q)) continue;
        if (dist(q, b) < 1.3) {
          b.seen.add(q);
          if (random() < 0.085) {
            q.box.stl++; b.from.box.tov++;
            say(`${q.name} fängt den Pass ab`, q.side === 'home' ? 'player' : 'opponent');
            return giveBall(q);
          }
        }
      }
      if (outOfBounds(b)) { b.from.box.tov++; say('Pass ins Aus', 'neutral'); turnover(other(b.from.side)); }
      return;
    }

    if (b.state === 'shot') {
      const s = b.shot;
      s.t += dt;
      const k = clamp(s.t / s.flight, 0, 1);
      b.x = lerp(s.from.x, s.to.x, k);
      b.y = lerp(s.from.y, s.to.y, k);
      b.z = 1.5 + Math.sin(k * Math.PI) * s.apex;
      if (s.t >= s.flight) resolveShot();
      return;
    }

    if (b.state === 'loose') {
      b.x += b.vx * dt; b.y += b.vy * dt;
      const drag = Math.pow(0.15, dt);
      b.vx *= drag; b.vy *= drag;
      b.z = Math.max(0.4, b.z - dt * 9);
      if (outOfBounds(b)) {
        const to = b.lastTouch ? other(b.lastTouch) : other(M.possession);
        say('Ball im Aus', 'neutral');
        return turnover(to);
      }
      // whoever gets there first, weighted by rebounding instinct
      let claim = null, bestScore = -1;
      M.players.forEach(q => {
        const d = dist(q, b);
        if (d > q.r + 1.6 || q.cooldown > 0) return;
        const inside = b.rebound && q.side !== b.rebound.offSide ? 0.10 : 0;
        const score = q.ratings.reb / 100 + inside + random() * 0.6 - d * 0.15;
        if (score > bestScore) { bestScore = score; claim = q; }
      });
      if (claim) {
        const off = b.rebound && claim.side === b.rebound.offSide;
        if (b.rebound) {
          if (off) { claim.box.oreb++; say(`Offensiv-Rebound ${claim.name}`, claim.side === 'home' ? 'player' : 'opponent'); }
          else { claim.box.dreb++; }
          b.rebound = null;
        }
        giveBall(claim, { oreb: off });
      }
    }
  }

  function catchBall(receiver) {
    const b = M.ball;
    M.lastPass = { from: b.from, to: receiver, at: M.gameTime };
    giveBall(receiver, { keepClock: true });
  }

  const outOfBounds = b => b.x < 0 || b.x > COURT.length || b.y < 0 || b.y > COURT.width;

  // ── Shooting ──────────────────────────────────────
  // Base percentages follow real NBA shot-zone efficiency.
  function shotQuality(shooter, defender, { forDecision = false } = {}) {
    const hoop = attackHoop(shooter.side);
    const d = dist(shooter, hoop);
    const three = isThree(shooter, hoop);
    let p;
    if (three) {
      p = Math.abs(shooter.y - MID) >= COURT.cornerOff ? 0.310 : 0.276;
      p -= Math.max(0, d - 25) * 0.024;   // deep threes and heaves fall off fast
    }
    else if (d <= 4) p = 0.648;
    else if (d <= 10) p = 0.462;
    else if (d <= 16) p = 0.420;
    else p = 0.405;
    const rating = (three || d > 10) ? shooter.ratings.three : shooter.ratings.rim;
    p += (rating - 55) / 100 * 0.22;
    const dd = defender ? dist(shooter, defender) : 99;
    if (dd < 2) p -= 0.13 + defender.ratings.defense / 100 * 0.05;
    else if (dd < 4) p -= 0.06;
    else if (dd < 6) p -= 0.01;
    else p += 0.05;
    if (defender && defender.jump > 0 && dd < 4.5) p -= 0.05;
    if (Math.hypot(shooter.vx, shooter.vy) > shooter.maxSpeed * 0.6 && d > 6) p -= 0.05;
    if (M.shotClock < 3) p -= 0.07;
    if (!forDecision) p -= (1 - (shooter.stamina ?? 1)) * 0.09;   // tired legs miss — but players do not plan around it
    return clamp(p, 0.03, 0.93);
  }

  function attemptShot(shooter, timing, why) {
    if (!M || M.phase !== 'live' || M.ball.holder !== shooter) return;
    const hoop = attackHoop(shooter.side);
    const def = nearestOpp(shooter);
    const dd = dist(shooter, def);
    const d = dist(shooter, hoop);
    const val = shotValue(shooter, hoop);
    const p = clamp(shotQuality(shooter, def) + (timing || 0), 0.02, 0.96);

    const blocked = def.jump > 0 && dd < 4.0 &&
      random() < clamp(0.14 + (def.ratings.defense - 55) / 500 + (d < 6 ? 0.07 : 0), 0.02, 0.34);
    const fouled = !blocked && dd < 3.0 &&
      random() < 0.14 + (def.jump > 0 ? 0.11 : 0) + (d < 6 ? 0.13 : 0);
    const made = !blocked && random() < p;

    shooter.box.fga++;
    if (val === 3) shooter.box.tpa++;
    const travelled = shooter.dribbleFrom ? dist(shooter, shooter.dribbleFrom) : 99;
    const assist = M.lastPass && M.lastPass.to === shooter &&
      M.gameTime - M.lastPass.at < 2.8 && travelled < 15 ? M.lastPass.from : null;

    // Where a miss ends up: long shots produce long rebounds
    const ang = Math.atan2(shooter.y - hoop.y, shooter.x - hoop.x) + rnd(-1.1, 1.1);
    const car = clamp(2.5 + d * 0.22 + rnd(-2, 3), 1.5, 17);
    const carom = {
      x: clamp(hoop.x + Math.cos(ang) * car, 1, COURT.length - 1),
      y: clamp(hoop.y + Math.sin(ang) * car, 1, COURT.width - 1),
    };

    M.ball.state = 'shot';
    M.ball.holder = null;
    M.ball.shot = {
      shooter, hoop, val, made, blocked, fouled, defender: def, assist, carom,
      from: { x: shooter.x, y: shooter.y }, to: blocked ? { x: shooter.x + rnd(-6, 6), y: shooter.y + rnd(-6, 6) } : hoop,
      t: 0,
      flight: blocked ? 0.35 : clamp(0.75 + d * 0.030, 0.7, 1.7),
      apex: blocked ? 3 : clamp(9 + d * 0.22, 9, 17),
    };
    shooter.cooldown = 0.35;
    if (blocked) { def.box.blk++; say(`Geblockt! ${def.name}`, def.side === 'home' ? 'player' : 'opponent'); }
  }

  function resolveShot() {
    const s = M.ball.shot;
    const b = M.ball;
    b.shot = null;
    if (s.blocked) {
      b.state = 'loose'; b.lastTouch = s.shooter.side; b.z = 1;
      b.vx = rnd(-14, 14); b.vy = rnd(-14, 14);
      b.rebound = { offSide: s.shooter.side };
      M.players.forEach(p => { p.cooldown = Math.max(p.cooldown, 0.25); });
      return;
    }
    if (s.made) {
      s.shooter.box.fgm++;
      if (s.val === 3) s.shooter.box.tpm++;
      if (s.assist) s.assist.box.ast++;
      score(s.shooter, s.val);
      const label = s.val === 3 ? 'Dreier' : dist(s.from, s.hoop) < 5 ? 'Korbleger' : 'Wurf';
      say(`${label} ${s.shooter.name} (${s.val})`, s.shooter.side === 'home' ? 'player' : 'opponent');
      if (s.fouled) { foul(s.defender, s.shooter, 1, true); return; }
      return deadBall(other(s.shooter.side));
    }
    // Missed
    if (s.fouled) { foul(s.defender, s.shooter, s.val, false); return; }
    say(`${s.shooter.name} verwirft`, 'neutral');
    b.state = 'loose';
    b.x = s.carom.x; b.y = s.carom.y; b.z = 6;
    b.vx = rnd(-6, 6); b.vy = rnd(-6, 6);
    b.lastTouch = s.shooter.side;
    b.rebound = { offSide: s.shooter.side };
  }

  function score(shooter, pts) {
    M[shooter.side].score += pts;
    shooter.box.pts += pts;
    M.players.forEach(p => { p.box.pm += p.side === shooter.side ? pts : -pts; });
    syncScoreboard();
    flash(`${pts} PUNKTE`);
  }

  // ── Fouls and free throws ─────────────────────────
  function foul(defender, victim, shots, andOne) {
    defender.box.pf++;
    M[defender.side].fouls++;
    say(`Foul ${defender.name}${andOne ? ' — And-One!' : ''}`, defender.side === 'home' ? 'opponent' : 'player');
    if (defender.box.pf >= RULES.foulOut) foulOut(defender);
    if (shots > 0) return startFreeThrows(victim, shots);
    // Non-shooting foul: bonus or side-out
    if (M[defender.side].fouls > RULES.bonusAt) return startFreeThrows(victim, 2);
    turnover(victim.side, { keepClock: true });
  }

  function foulOut(p) {
    p.out = true;
    say(`${p.name} hat 6 Fouls — raus`, 'neutral');
    const team = M[p.side];
    let sub = team.roster.filter(q => !q.onCourt && !q.out && q.role === p.role).sort((a, b) => b.stamina - a.stamina)[0]
           || team.roster.filter(q => !q.onCourt && !q.out).sort((a, b) => b.stamina - a.stamina)[0];
    if (!sub) {   // an empty bench: someone from the stands
      sub = makePlayer(p.side, p.role, `${pick(FIRST)}. ${pick(LAST)}`, ROLES[p.role].n + irnd(0, 9), ratingsFor(p.role, team.strength - 16));
      team.roster.push(sub);
    }
    sub.x = p.x; sub.y = p.y; sub.onCourt = true;
    p.onCourt = false;
    team.players[team.players.indexOf(p)] = sub;
    M.players[M.players.indexOf(p)] = sub;
    if (p.human) { M.human.benched = true; M.autoHuman = true; M.fastForward = true; flash('AUSGEFOULT'); }
    if (M.ball.holder === p) giveBall(sub);
  }

  function startFreeThrows(shooter, count) {
    M.phase = 'freethrow';
    M.ft = { shooter, left: count, wait: shooter.human && !M.autoHuman ? 99 : 1.1, meter: 0, dir: 1, locked: false };
    const hoop = attackHoop(shooter.side);
    const line = { x: hoop.x + hoop.dir * (COURT.laneL - COURT.rim), y: MID };
    shooter.x = line.x; shooter.y = line.y; shooter.vx = shooter.vy = 0;
    M.ball = { x: line.x, y: line.y, z: 2, vx: 0, vy: 0, holder: shooter, state: 'held', shot: null };
    // line up along the lane
    let i = 0;
    M.players.forEach(p => {
      if (p === shooter) return;
      const side = i % 2 ? 1 : -1;
      const depth = COURT.rim + 7 + Math.floor(i / 2) * 4;
      p.x = hoop.x + hoop.dir * (depth - COURT.rim);
      p.y = MID + side * (COURT.laneW / 2 + 1.2);
      p.vx = p.vy = 0;
      i++;
    });
  }

  function updateFreeThrow(dt) {
    const ft = M.ft;
    if (!ft) return;
    if (ft.locked) return;
    if (ft.shooter.human && !M.autoHuman) {
      ft.meter = clamp(ft.meter + ft.dir * dt * 0.85, 0, 1);
      if (ft.meter >= 1) ft.dir = -1;
      if (ft.meter <= 0) ft.dir = 1;
      return;
    }
    ft.wait -= dt;
    if (ft.wait <= 0) shootFreeThrow(0);
  }

  function ftPress() {
    const ft = M.ft;
    if (!ft || ft.locked || !ft.shooter.human) return;
    // sweet spot at the top of the meter
    const off = Math.abs(ft.meter - 0.85);
    shootFreeThrow(off < 0.05 ? 0.14 : off < 0.12 ? 0.07 : off < 0.25 ? 0 : -0.12);
  }

  function shootFreeThrow(bonus) {
    const ft = M.ft;
    ft.locked = true;
    const s = ft.shooter;
    const p = clamp(0.575 + s.ratings.ft / 100 * 0.25 + bonus, 0.25, 0.98);
    const made = random() < p;
    s.box.fta++;
    if (made) { s.box.ftm++; score(s, 1); }
    ft.left--;
    say(`Freiwurf ${s.name} ${made ? 'trifft' : 'daneben'}`, s.side === 'home' ? (made ? 'player' : 'neutral') : (made ? 'opponent' : 'neutral'));
    setTimeout(() => {
      if (!M || M.phase !== 'freethrow') return;
      if (ft.left > 0) { M.ft = { ...ft, wait: s.human && !M.autoHuman ? 99 : 1.0, meter: 0, dir: 1, locked: false }; return; }
      M.ft = null;
      M.phase = 'live';
      if (made) return deadBall(other(s.side));
      // live ball off the last miss
      const hoop = attackHoop(s.side);
      M.ball = {
        x: hoop.x + hoop.dir * 2, y: MID + rnd(-5, 5), z: 5,
        vx: rnd(-8, 8), vy: rnd(-8, 8), holder: null, state: 'loose',
        shot: null, lastTouch: s.side, rebound: { offSide: s.side },
      };
      M.shotClock = RULES.shotClockOreb;
    }, 700 / RULES.timeScale);
  }

  // ── Possession changes and periods ────────────────
  function turnover(toSide, opts = {}) {
    if (!M || M.phase === 'finished') return;
    deadBall(toSide, opts);
  }

  // Swap `out` for `sub` at the same spot on the floor
  function substitute(team, out, sub, why) {
    if (!sub || sub === out) return false;
    sub.x = out.x; sub.y = out.y; sub.vx = sub.vy = 0; sub.paint = 0;
    sub.onCourt = true; sub.benchedFor = 0; sub.stintStart = M.gameTime;
    out.onCourt = false; out.satAt = M.gameTime; out.vx = out.vy = 0;
    team.players[team.players.indexOf(out)] = sub;
    M.players[M.players.indexOf(out)] = sub;
    if (M.ball?.holder === out) giveBall(sub, { keepClock: true });
    say(`Wechsel ${team.name}: ${sub.name} für ${out.name}${why ? ` (${why})` : ''}`, 'neutral');
    if (out.human) flash('AUF DIE BANK');
    if (sub.human) flash('DU BIST DRIN');
    return true;
  }

  // How the human has been playing: shooting and turnovers decide how long he sits
  function humanForm(h) {
    const b = h.box, fg = b.fga >= 5 ? b.fgm / b.fga : 0.45;
    if (fg < 0.3 || b.tov >= 4) return 'cold';
    if (fg > 0.5 && b.fga >= 5) return 'hot';
    return 'ok';
  }

  // The coach looks at the floor at every stoppage (#48).
  function coach(team) {
    if (M.noRotations) return;
    const margin = Math.abs(M.home.score - M.away.score);
    const lateBlowout = M.quarter >= RULES.quarters && margin >= 20 && M.clock < RULES.quarterMinutes * 60 * 0.6;
    const foulLimit = M.quarter < RULES.quarters ? 4 : 5;
    const benchFor = role => team.roster.filter(p => !p.onCourt && !p.out && p.role === role);
    // 1. who has to come off
    team.players.slice().forEach(p => {
      let why = null;
      const stint = (M.gameTime - (p.stintStart || 0)) / 60 * pace();
      if (p.stamina < 0.45) why = 'müde';
      else if (stint > (p.starter ? 10.5 : 7) && !(p.human && humanForm(p) === 'hot')) why = 'Verschnaufpause';
      else if (p.fouls >= foulLimit && p.fouls < RULES.foulOut) why = 'Foulgefahr';
      else if (lateBlowout && p.starter) why = 'Spiel entschieden';
      else if (p.box.fga >= 7 && p.box.fgm / p.box.fga < 0.22 && p.stamina < 0.8) why = 'kalt';
      if (!why) return;
      const rested = benchFor(p.role).filter(q => q.stamina >= 0.55).sort((a, b) => b.stamina - a.stamina)[0];
      if (rested) substitute(team, p, rested, why);
    });
    // 2. who comes back: a rested starter for the bench man in his spot
    team.roster.filter(p => p.starter && !p.onCourt && !p.out).forEach(st => {
      const need = st.human ? { cold: 0.92, ok: 0.82, hot: 0.7 }[humanForm(st)] : 0.8;
      if (st.stamina < need) return;
      if (lateBlowout) return;
      const onCourt = team.players.find(q => q.role === st.role && !q.starter);
      if (onCourt) substitute(team, onCourt, st, 'zurück');
    });
  }

  function deadBall(toSide) {
    if (!M || M.phase === 'finished') return;
    M.phase = 'dead';
    M.deadUntil = RULES.inbound;
    M.shotClock = RULES.shotClock;
    coach(M.home); coach(M.away);
    resetPositions(toSide);
  }

  function recordQuarterShooting() {
    ['home', 'away'].forEach(sd => {
      const tot = M[sd].roster.reduce((a, p) => ({ fgm: a.fgm + p.box.fgm, fga: a.fga + p.box.fga }), { fgm: 0, fga: 0 });
      const prev = M.quarterShooting[sd].reduce((a, q) => ({ fgm: a.fgm + q.fgm, fga: a.fga + q.fga }), { fgm: 0, fga: 0 });
      M.quarterShooting[sd].push({ fgm: tot.fgm - prev.fgm, fga: tot.fga - prev.fga });
    });
  }

  function endPeriod() {
    recordQuarterShooting();
    const tied = M.home.score === M.away.score;
    if (M.quarter >= RULES.quarters && !tied) return finish();
    M.quarter++;
    M.home.fouls = 0; M.away.fouls = 0;
    M.clock = (M.quarter > RULES.quarters ? RULES.otMinutes : RULES.quarterMinutes) * 60;
    M.shotClock = RULES.shotClock;
    const label = M.quarter > RULES.quarters ? `Verlängerung ${M.quarter - RULES.quarters}` : `${M.quarter}. Viertel`;
    say(label, 'neutral');
    flash(label);
    if (M.quarter === 3) say('Seitenwechsel', 'neutral');
    M.phase = 'dead';
    M.deadUntil = RULES.inbound * 2;
    // the break: everyone gets some legs back, then the coach sets the five
    ['home', 'away'].forEach(sd => M[sd].roster.forEach(p => { p.stamina = Math.min(1, p.stamina + (M.quarter === 3 ? 0.18 : 0.08)); }));
    coach(M.home); coach(M.away);
    resetPositions(random() < 0.5 ? 'home' : 'away', { tip: M.quarter > RULES.quarters });
    syncScoreboard();
  }

  function finish() {
    recordQuarterShooting();
    M.phase = 'finished';
    if (M.raf) cancelAnimationFrame(M.raf);
    M.cleanup?.();
    const line = t => t.roster.map(p => ({
      name: p.name, number: p.number, role: p.role, human: !!p.human,
      ...p.box,
      min: Math.round(p.box.min * 10) / 10,
      reb: p.box.oreb + p.box.dreb,
    })).sort((a, b) => b.pts - a.pts);
    const result = {
      score: { home: M.home.score, away: M.away.score },
      home: M.home.name, away: M.away.name,
      result: M.home.score > M.away.score ? 'win' : 'loss',
      box: { home: line(M.home), away: line(M.away) },
      human: line(M.home).find(l => l.human),
      events: M.events.slice(-14),
      quarters: M.quarter,
      quarterShooting: M.quarterShooting,
      stats: M.stats,
    };
    const done = M.opts.onFinish;
    M = null;
    done?.(result);
  }

  // ── Rendering ─────────────────────────────────────
  function metrics(canvas) {
    const S = Math.min((canvas.width - 28) / COURT.length, (canvas.height - 28) / COURT.width);
    return { S, ox: (canvas.width - COURT.length * S) / 2, oy: (canvas.height - COURT.width * S) / 2, w: canvas.width, h: canvas.height };
  }

  const KIT = {
    home: { body: '#f2c14e', trim: '#20242c', skin: '#c98d63' },
    away: { body: '#3d63c9', trim: '#e8ecff', skin: '#8a5a3c' },
  };

  function drawCourt(ctx, m) {
    const { S, ox, oy, w, h } = m;
    const X = f => ox + f * S, Y = f => oy + f * S;
    ctx.fillStyle = '#10151b';
    ctx.fillRect(0, 0, w, h);

    // Hardwood, with plank lines
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, '#c98d4e'); g.addColorStop(0.5, '#bd7f42'); g.addColorStop(1, '#a96c36');
    ctx.fillStyle = g;
    ctx.fillRect(X(-1.4), Y(-1.4), (COURT.length + 2.8) * S, (COURT.width + 2.8) * S);
    ctx.strokeStyle = 'rgba(60,30,10,.10)'; ctx.lineWidth = 1;
    for (let f = 0; f < COURT.width + 2; f += 2.2) {
      ctx.beginPath(); ctx.moveTo(X(-1.4), Y(f - 1.4)); ctx.lineTo(X(COURT.length + 1.4), Y(f - 1.4)); ctx.stroke();
    }

    // Painted lanes
    [HOOP_L, HOOP_R].forEach(hp => {
      const x0 = hp.baseline + (hp.dir > 0 ? 0 : -COURT.laneL);
      ctx.fillStyle = 'rgba(29,79,140,.85)';
      ctx.fillRect(X(x0), Y(MID - COURT.laneW / 2), COURT.laneL * S, COURT.laneW * S);
    });

    ctx.strokeStyle = 'rgba(255,255,255,.9)';
    ctx.lineWidth = Math.max(1.6, S * 0.2);
    ctx.strokeRect(X(0), Y(0), COURT.length * S, COURT.width * S);
    ctx.beginPath(); ctx.moveTo(X(COURT.length / 2), Y(0)); ctx.lineTo(X(COURT.length / 2), Y(COURT.width)); ctx.stroke();
    ctx.beginPath(); ctx.arc(X(COURT.length / 2), Y(MID), COURT.centreR * S, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(X(COURT.length / 2), Y(MID), 2 * S, 0, Math.PI * 2); ctx.stroke();

    [HOOP_L, HOOP_R].forEach(hp => {
      const d = hp.dir, bx = hp.baseline;
      // lane + free-throw circle
      const x0 = bx + (d > 0 ? 0 : -COURT.laneL);
      ctx.strokeRect(X(x0), Y(MID - COURT.laneW / 2), COURT.laneL * S, COURT.laneW * S);
      const ftx = bx + d * COURT.laneL;
      ctx.beginPath(); ctx.arc(X(ftx), Y(MID), COURT.ftR * S, -Math.PI / 2, Math.PI / 2, d < 0); ctx.stroke();
      ctx.save(); ctx.setLineDash([S * 0.9, S * 0.9]);
      ctx.beginPath(); ctx.arc(X(ftx), Y(MID), COURT.ftR * S, Math.PI / 2, -Math.PI / 2, d < 0); ctx.stroke();
      ctx.restore();
      // three-point line: straight corners, then the arc
      const a1 = Math.atan2(-COURT.cornerOff, d * COURT.cornerX);
      const a2 = Math.atan2(COURT.cornerOff, d * COURT.cornerX);
      ctx.beginPath();
      ctx.moveTo(X(bx), Y(MID - COURT.cornerOff));
      ctx.lineTo(X(hp.x + d * COURT.cornerX), Y(MID - COURT.cornerOff));
      ctx.arc(X(hp.x), Y(hp.y), COURT.threeR * S, a1, a2, d < 0);
      ctx.lineTo(X(bx), Y(MID + COURT.cornerOff));
      ctx.stroke();
      // restricted area
      ctx.beginPath();
      ctx.arc(X(hp.x), Y(hp.y), COURT.restricted * S, -Math.PI / 2, Math.PI / 2, d < 0);
      ctx.stroke();
      // backboard and rim
      const bbx = bx + d * COURT.board;
      ctx.lineWidth = Math.max(2.5, S * 0.32);
      ctx.strokeStyle = '#f4f7ff';
      ctx.beginPath(); ctx.moveTo(X(bbx), Y(MID - COURT.boardW / 2)); ctx.lineTo(X(bbx), Y(MID + COURT.boardW / 2)); ctx.stroke();
      ctx.strokeStyle = '#ef7d2e';
      ctx.lineWidth = Math.max(2, S * 0.22);
      ctx.beginPath(); ctx.arc(X(hp.x), Y(hp.y), COURT.rimR * S, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,.9)';
      ctx.lineWidth = Math.max(1.6, S * 0.2);
    });
  }

  function drawFigure(ctx, m, p, selected) {
    const { S, ox, oy } = m;
    const px = ox + p.x * S, py = oy + p.y * S;
    const kit = KIT[p.side];
    const r = (p.r || 1.35) * S;
    const angle = Number.isFinite(p.facing) ? p.facing : (p.side === 'home' ? 0 : Math.PI);
    const moving = Math.hypot(p.vx || 0, p.vy || 0) > 5;
    const step = moving ? Math.sin(p.stride || 0) * 3 : 0;
    const lift = (p.jump > 0 ? 3 : 0);

    ctx.save();
    ctx.translate(px, py);
    ctx.fillStyle = 'rgba(0,0,0,.32)';
    ctx.beginPath(); ctx.ellipse(2, 4 + lift, r * 0.95, r * 0.6, 0, 0, Math.PI * 2); ctx.fill();
    ctx.translate(0, -lift);
    ctx.rotate(angle);
    // legs
    ctx.strokeStyle = kit.trim; ctx.lineWidth = r * 0.34; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-r * 0.5, -r * 0.25); ctx.lineTo(-r * 1.05, -r * 0.72 + step);
    ctx.moveTo(-r * 0.5, r * 0.25); ctx.lineTo(-r * 1.05, r * 0.72 - step);
    ctx.stroke();
    // arms
    ctx.strokeStyle = kit.skin; ctx.lineWidth = r * 0.26;
    ctx.beginPath();
    ctx.moveTo(0, -r * 0.55); ctx.lineTo(r * 0.35, -r * 1.05 - step * 0.3);
    ctx.moveTo(0, r * 0.55); ctx.lineTo(r * 0.35, r * 1.05 + step * 0.3);
    ctx.stroke();
    // jersey
    ctx.fillStyle = kit.body; ctx.strokeStyle = kit.trim; ctx.lineWidth = Math.max(1, r * 0.13);
    ctx.beginPath();
    ctx.moveTo(-r * 0.7, -r * 0.7);
    ctx.quadraticCurveTo(r * 0.15, -r * 0.95, r * 0.7, -r * 0.55);
    ctx.lineTo(r * 0.7, r * 0.55);
    ctx.quadraticCurveTo(r * 0.15, r * 0.95, -r * 0.7, r * 0.7);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = kit.trim;
    ctx.font = `800 ${Math.round(r * 0.62)}px system-ui`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.save(); ctx.rotate(-angle); ctx.fillText(String(p.number ?? ''), 0, 0); ctx.restore();
    // head
    ctx.fillStyle = kit.skin; ctx.strokeStyle = 'rgba(40,24,14,.7)'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.arc(r * 0.8, 0, r * 0.42, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.restore();

    if (selected) {
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(px, py, r * 1.5, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.moveTo(px - 5, py - r * 1.8 - 8); ctx.lineTo(px + 5, py - r * 1.8 - 8); ctx.lineTo(px, py - r * 1.8 - 1);
      ctx.fill();
    }
    if (p.side === M?.possession && M?.ball?.holder === p) {
      ctx.strokeStyle = 'rgba(239,125,46,.9)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(px, py, r * 1.25, 0, Math.PI * 2); ctx.stroke();
    }
  }

  function drawBall(ctx, m, b) {
    const { S, ox, oy } = m;
    const px = ox + b.x * S, py = oy + b.y * S;
    const z = Math.max(0, b.z || 0);
    ctx.fillStyle = `rgba(0,0,0,${clamp(0.34 - z * 0.012, 0.06, 0.34)})`;
    ctx.beginPath(); ctx.ellipse(px, py + 2, S * 0.42, S * 0.26, 0, 0, Math.PI * 2); ctx.fill();
    const by = py - z * S * 0.55;
    const r = S * 0.42 * (1 + z * 0.022);
    ctx.fillStyle = '#ef7d2e';
    ctx.beginPath(); ctx.arc(px, by, r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(60,25,5,.85)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(px, by, r, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(px - r, by); ctx.lineTo(px + r, by);
    ctx.moveTo(px, by - r); ctx.lineTo(px, by + r); ctx.stroke();
  }

  function draw() {
    if (!M) return;
    const m = { S: M.S, ox: M.ox, oy: M.oy, w: M.canvas.width, h: M.canvas.height };
    const ctx = M.ctx;
    drawCourt(ctx, m);
    M.players.forEach(p => drawFigure(ctx, m, p, p.human));
    drawBall(ctx, m, M.ball);
    drawHud(ctx, m);
  }

  function drawHud(ctx, m) {
    const h = M.human;
    // shot charge
    if (M.charge) meter(ctx, m, h, M.charge.t, 0.62, '#dfff53');
    if (M.phase === 'freethrow' && M.ft?.shooter?.human && !M.autoHuman) {
      meter(ctx, m, M.ft.shooter, M.ft.meter, 0.85, '#ffd166');
      label(ctx, m, M.ft.shooter, 'LEERTASTE zum Wurf');
    }
    if (h.paint > 1.6 && !h.benched && h.onCourt) label(ctx, m, h, `${(RULES.threeSec - h.paint).toFixed(1)}s Zone`);
    // fatigue, always visible (#49)
    ctx.fillStyle = 'rgba(6,10,14,.7)'; ctx.fillRect(12, m.h - 26, 130, 16);
    ctx.fillStyle = h.stamina > 0.6 ? '#7ddc7d' : h.stamina > 0.4 ? '#ffd166' : '#ef5c53';
    ctx.fillRect(14, m.h - 24, 126 * clamp(h.stamina, 0, 1), 12);
    ctx.fillStyle = '#eef3f7'; ctx.font = '700 9px system-ui'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(`KRAFT ${Math.round(h.stamina * 100)}%`, 18, m.h - 18);
    if (!h.onCourt && !h.benched) {
      ctx.fillStyle = 'rgba(10,14,18,.75)'; ctx.fillRect(m.w / 2 - 150, 10, 300, 26);
      ctx.fillStyle = '#ffd166'; ctx.font = '800 12px system-ui'; ctx.textAlign = 'center';
      ctx.fillText(`AUF DER BANK — ${humanForm(h) === 'cold' ? 'der Coach ist nicht zufrieden' : humanForm(h) === 'hot' ? 'kurze Pause' : 'Kraft tanken'}`, m.w / 2, 27);
    }
    if (M.fastForward) {
      ctx.fillStyle = 'rgba(10,14,18,.72)';
      ctx.fillRect(m.w / 2 - 96, 10, 192, 26);
      ctx.fillStyle = '#dfff53'; ctx.font = '800 13px system-ui'; ctx.textAlign = 'center';
      ctx.fillText(h.benched ? 'AUSGEFOULT — SIMULATION' : 'SCHNELLDURCHLAUF', m.w / 2, 27);
    }
  }

  function meter(ctx, m, p, value, sweet, color) {
    const px = m.ox + p.x * m.S, py = m.oy + p.y * m.S - 34;
    const w = 54, hgt = 7;
    ctx.fillStyle = 'rgba(6,10,14,.8)'; ctx.fillRect(px - w / 2, py, w, hgt);
    ctx.fillStyle = 'rgba(120,255,120,.45)'; ctx.fillRect(px - w / 2 + w * (sweet - 0.06), py, w * 0.12, hgt);
    ctx.fillStyle = color; ctx.fillRect(px - w / 2, py, w * clamp(value, 0, 1), hgt);
    ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 1; ctx.strokeRect(px - w / 2, py, w, hgt);
  }

  function label(ctx, m, p, text) {
    const px = m.ox + p.x * m.S, py = m.oy + p.y * m.S - 44;
    ctx.font = '700 11px system-ui'; ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(6,10,14,.78)';
    const w = ctx.measureText(text).width + 12;
    ctx.fillRect(px - w / 2, py - 12, w, 16);
    ctx.fillStyle = '#ffd166';
    ctx.fillText(text, px, py);
  }

  // ── DOM plumbing ──────────────────────────────────
  const el = id => document.getElementById(id);
  const mmss = s => `${String(Math.floor(Math.max(0, s) / 60)).padStart(2, '0')}:${String(Math.floor(Math.max(0, s) % 60)).padStart(2, '0')}`;

  function syncScoreboard() {
    if (!M) return;
    const set = (id, v) => { const n = el(id); if (n && n.textContent !== String(v)) n.textContent = v; };
    set('bb-home-score', M.home.score);
    set('bb-away-score', M.away.score);
    set('bb-clock', mmss(M.clock));
    set('bb-shot', M.shotClock < 5 ? M.shotClock.toFixed(1) : Math.ceil(M.shotClock));
    set('bb-quarter', M.quarter > RULES.quarters ? `OT${M.quarter - RULES.quarters}` : `Q${M.quarter}`);
    set('bb-home-fouls', `${M.home.fouls}${M.home.fouls > RULES.bonusAt ? ' • BONUS' : ''}`);
    set('bb-away-fouls', `${M.away.fouls}${M.away.fouls > RULES.bonusAt ? ' • BONUS' : ''}`);
  }

  function say(text, type = 'neutral') {
    if (!M) return;
    const clock = `${M.quarter > RULES.quarters ? 'OT' : 'Q' + M.quarter} ${mmss(M.clock)}`;
    M.events.push({ text, type, clock });
    const t = el('bb-ticker');
    if (t) {
      const row = document.createElement('div');
      row.className = `bb-tick ${type}`;
      row.innerHTML = `<b>${clock}</b> ${text}`;
      t.prepend(row);
      while (t.children.length > 5) t.lastChild.remove();
    }
  }

  function flash(text) {
    const n = el('bb-message');
    if (!n) return;
    n.textContent = text;
    n.classList.add('show');
    setTimeout(() => n.classList.remove('show'), 900);
  }

  // Court drawn before tip-off, with the starting five in place
  function preview(canvasId) {
    const canvas = el(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const m = metrics(canvas);
    drawCourt(ctx, m);
    const hoop = HOOP_R;
    const spots = {
      PG: { x: hoop.x - 26, y: MID }, SG: { x: hoop.x - 20, y: MID - 15 }, SF: { x: hoop.x - 20, y: MID + 15 },
      PF: { x: hoop.x - 3, y: MID + 21 }, C: { x: hoop.x - 6, y: MID - 7 },
    };
    ORDER.forEach((role, i) => {
      const s = spots[role];
      drawFigure(ctx, m, { ...s, side: 'home', r: 1.35, number: ROLES[role].n, facing: 0 }, i === 0);
      drawFigure(ctx, m, { x: s.x + 4.5, y: clamp(s.y + 2, 3, COURT.width - 3), side: 'away', r: 1.35, number: ROLES[role].n + 4, facing: Math.PI }, false);
    });
    drawBall(ctx, m, { x: spots.PG.x + 1.6, y: spots.PG.y, z: 1.4 });
  }

  return { start, abort, isRunning, preview, RULES, ROLES, ROLE_BY_LABEL };
})();
