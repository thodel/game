// =====================================================
// SPORTS CAREER GAME — game.js
// Football & Basketball career simulator
// =====================================================

const App = (() => {
  // ── State ──────────────────────────────────────────
  let state = null;

  // ── Config ─────────────────────────────────────────
  const CONFIG = {
    football: {
      name: 'Fussball',
      icon: '⚽',
      color: 'football',
      positions: ['Torwart', 'Abwehr', 'Mittelfeld', 'Stürmer'],
      stats: ['Tempo', 'Technik', 'Schuss', 'Dribbling', 'Kondition', 'Kopfball'],
      leagues: ['Kreisliga', '4. Liga', '3. Liga', 'Regionalliga', '2. Bundesliga', 'Bundesliga', 'Champions League'],
      matchEvents: {
        player: ['Tor! ⚽', 'Traumpass 🎯', 'Elfer verwandelt 💥', 'Flanke zum Tor 🎪', 'Freistoss ✨'],
        opponent: ['Gegentor 😤', 'Elfmeter kassiert ⚠️', 'Rote Karte! 🟥', 'Eigentor 😱'],
        neutral: ['Gelbe Karte 🟨', 'Pfostentreffer 😬', 'Grosschance vergeben 😤', 'Verlängerung! ⏱️'],
      },
      teamNames: ['FC Bayern', 'Dortmund', 'Leipzig', 'Leverkusen', 'Frankfurt', 'Stuttgart', 'Wolfsburg', 'Hoffenheim', 'Freiburg', 'Mainz', 'Augsburg', 'Bochum', 'Gladbach', 'Union Berlin', 'Heidenheim', 'Köln', 'Schalke', 'Hamburg'],
    },
    basketball: {
      name: 'Basketball',
      icon: '🏀',
      color: 'basketball',
      positions: ['Point Guard', 'Shooting Guard', 'Small Forward', 'Power Forward', 'Center'],
      stats: ['Speed', 'Ballhandling', '3-Pointer', 'Defense', 'Dunks', 'IQ'],
      leagues: ['Street League', 'D-Liga', 'Regionalliga', 'Pro B', 'BBL', 'Euroleague', 'NBA'],
      matchEvents: {
        player: ['3-Pointer! 🎯', 'Slam Dunk! 💥', 'No-Look Pass 😎', 'Steal + Layup ⚡', 'And-One! 🔥'],
        opponent: ['Blocked! 🛡️', 'Turnover 😤', 'Foul Trouble ⚠️'],
        neutral: ['Buzzer-Beater 🚨', 'Overtime! ⏱️', 'Technical Foul 😤', 'Timeout called ⏸️'],
      },
      teamNames: ['Berlin Albatrosse', 'München Towers', 'Frankfurt Skyliners', 'Hamburg Towers', 'Bonn Telekom Baskets', 'Ulm Ratiopharm', 'Ludwigsburg MHP RIESEN', 'Heidelberg', 'Bamberg Brose', 'Göttingen Veilchen', 'Vechta Rasta', 'Quakenbrück Artland', 'Giessen 46ers', 'Oldenburg EWE Baskets'],
    },
  };

  const ACHIEVEMENTS = [
    { id: 'first_win', name: 'Erster Sieg!', desc: 'Dein erstes Spiel gewonnen', icon: '🏆', check: s => s.career.wins >= 1 },
    { id: 'season1', name: 'Erstes Comeback', desc: 'Erste Saison abgeschlossen', icon: '📅', check: s => s.career.seasons >= 1 },
    { id: 'hat_trick', name: 'Hattrick-Held', desc: '3+ Tore in einem Spiel', icon: '⚽⚽⚽', check: s => s.career.bestMatchGoals >= 3 },
    { id: 'promoted', name: 'Aufsteiger', desc: 'Erste Liga-Beförderung', icon: '📈', check: s => s.career.promotions >= 1 },
    { id: 'mvp', name: 'MVP', desc: '10+ Spiele gewonnen', icon: '🌟', check: s => s.career.wins >= 10 },
    { id: 'legend', name: 'Legende', desc: 'Top-Liga erreicht (Liga 6)', icon: '👑', check: s => s.career.leagueIndex >= 5 },
    { id: 'veteran', name: 'Veteran', desc: '5 Saisons gespielt', icon: '🎖️', check: s => s.career.seasons >= 5 },
    { id: 'rich', name: 'Millionär', desc: '1.000.000 € verdient', icon: '💰', check: s => s.player.totalEarned >= 1000000 },
  ];

  // ── Persistence ────────────────────────────────────
  const SAVE_KEY = 'sportsCareerGame_v1';
  function saveGame() { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); }
  function loadGame() {
    try { const d = localStorage.getItem(SAVE_KEY); return d ? JSON.parse(d) : null; } catch { return null; }
  }
  function clearSave() { localStorage.removeItem(SAVE_KEY); }

  // ── Utils ──────────────────────────────────────────
  function rand(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
  function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
  function fmt(n) { return n.toLocaleString('de-CH'); }
  function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }

  function newState(sport, playerName, position) {
    const cfg = CONFIG[sport];
    const baseStats = {};
    cfg.stats.forEach(s => { baseStats[s] = rand(20, 40); });
    return {
      sport,
      player: {
        name: playerName,
        position,
        age: 17,
        energy: 100,
        morale: 75,
        fame: 0,
        money: 500,
        totalEarned: 0,
        stats: baseStats,
        skillPoints: 3,
      },
      career: {
        leagueIndex: 0,
        teamName: cfg.teamNames[0],
        season: 1,
        seasons: 0,
        week: 1,
        weeksPerSeason: 24,
        wins: 0,
        losses: 0,
        draws: 0,
        goals: 0,          // points/goals scored by player
        assists: 0,
        promotions: 0,
        relegations: 0,
        bestMatchGoals: 0,
      },
      achievements: [],
      log: [],
      seasonLog: [],
    };
  }

  // ── Computed helpers ───────────────────────────────
  function avgStat(player) {
    const vals = Object.values(player.stats);
    return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
  }

  function leagueName(s) {
    return CONFIG[s.sport].leagues[s.career.leagueIndex] || 'Unbekannt';
  }

  function statColor(v) {
    if (v < 30) return 'low';
    if (v < 50) return 'mid';
    if (v < 75) return 'high';
    return 'max';
  }

  // ── Achievement check ──────────────────────────────
  function checkAchievements() {
    const newOnes = [];
    for (const ach of ACHIEVEMENTS) {
      if (!state.achievements.includes(ach.id) && ach.check(state)) {
        state.achievements.push(ach.id);
        newOnes.push(ach);
      }
    }
    return newOnes;
  }

  function showAchievement(ach) {
    const el = document.createElement('div');
    el.className = 'achievement-popup';
    el.innerHTML = `<div class="ach-title">🏆 Achievement unlocked</div>
      <div class="ach-name">${ach.icon} ${ach.name}</div>
      <div class="ach-desc">${ach.desc}</div>`;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 3500);
  }

  // ── Log helper ─────────────────────────────────────
  function addLog(msg, type = 'neutral') {
    const icons = { good: '✅', bad: '❌', neutral: '📋', special: '⭐' };
    state.log.unshift({ msg, type, icon: icons[type] });
    if (state.log.length > 40) state.log.pop();
  }

  // ── MATCH SIMULATION ──────────────────────────────
  function simulateMatch() {
    const cfg = CONFIG[state.sport];
    const p = state.player;
    const c = state.career;
    const skill = avgStat(p);
    const leagueDiff = c.leagueIndex * 8;
    const opponentStrength = clamp(30 + leagueDiff + rand(-10, 10), 20, 95);
    const playerStrength = clamp(skill + rand(-8, 8), 10, 100);

    // Energy affects performance
    const energyFactor = p.energy / 100;
    const moraleFactor = p.morale / 100;
    const effectiveStrength = playerStrength * energyFactor * 0.7 + playerStrength * moraleFactor * 0.3;

    // Score generation
    const isFootball = state.sport === 'football';
    const maxGoals = isFootball ? 6 : 130;
    const baseGoals = isFootball ? 3 : 85;

    const playerGoals = Math.round((effectiveStrength / (effectiveStrength + opponentStrength)) * baseGoals + rand(0, isFootball ? 3 : 15));
    const oppGoals = Math.round((opponentStrength / (effectiveStrength + opponentStrength)) * baseGoals + rand(0, isFootball ? 3 : 15));

    // Player personal contribution
    const contribution = Math.round(playerGoals * (skill / 100) * rand(3, 8) / 10);
    const assists = Math.round(contribution * rand(3, 7) / 10);
    const personal = contribution - assists;

    // Match events log
    const events = [];
    const numEvents = rand(4, 8);
    const allEvents = [...cfg.matchEvents.player, ...cfg.matchEvents.opponent, ...cfg.matchEvents.neutral];
    const shuffled = shuffle(allEvents);
    for (let i = 0; i < Math.min(numEvents, shuffled.length); i++) {
      const e = shuffled[i];
      const isPlayer = cfg.matchEvents.player.includes(e);
      const isOpp = cfg.matchEvents.opponent.includes(e);
      const minute = rand(5, 90);
      events.push({ text: e, minute, type: isPlayer ? 'player' : isOpp ? 'opponent' : 'neutral' });
    }
    events.sort((a, b) => a.minute - b.minute);

    // Opponent name
    const oppNames = cfg.teamNames.filter(n => n !== c.teamName);
    const opponent = oppNames[rand(0, oppNames.length - 1)];

    // Result
    let result, money;
    if (playerGoals > oppGoals) {
      result = 'win'; c.wins++; money = rand(800, 2000) * (c.leagueIndex + 1);
    } else if (playerGoals === oppGoals) {
      result = 'draw'; c.draws++; money = rand(200, 600) * (c.leagueIndex + 1);
    } else {
      result = 'loss'; c.losses++; money = rand(100, 400) * (c.leagueIndex + 1);
    }

    c.goals += personal;
    c.assists += assists;
    if (personal > c.bestMatchGoals) c.bestMatchGoals = personal;

    p.money += money;
    p.totalEarned += money;
    p.energy = clamp(p.energy - rand(15, 30), 0, 100);
    p.morale = result === 'win' ? clamp(p.morale + rand(5, 15), 0, 100)
             : result === 'loss' ? clamp(p.morale - rand(5, 12), 0, 100)
             : p.morale;
    p.fame += result === 'win' ? rand(3, 8) : rand(0, 2);

    // Week advance
    c.week++;
    if (c.week > c.weeksPerSeason) endSeason();

    return {
      playerGoals, oppGoals, result, opponent,
      events, money, personal, assists,
      score: isFootball ? `${playerGoals} : ${oppGoals}` : `${playerGoals + 50} : ${oppGoals + 50}`,
    };
  }

  // ── INTERACTIVE FOOTBALL MATCH ───────────────────
  // The career mode owns progression; this engine only produces a match result.
  let liveMatch = null;

  function footballOpponent() {
    const teams = CONFIG.football.teamNames.filter(n => n !== state.career.teamName);
    return teams[rand(0, teams.length - 1)];
  }

  function showFootballMatch() {
    const opponent = footballOpponent();
    liveMatch = { opponent, phase: 'intro', keys: new Set(), raf: null, cleanup: null, introStart: performance.now(), introTimer: null };
    render(`
      <div class="screen stadium-screen">
        ${renderHUD()}
        <div class="card stadium-card">
          <canvas id="stadium-intro-canvas" width="1200" height="675" aria-label="Teams laufen in das Stadion ein"></canvas>
          <div class="stadium-vignette"></div>
          <div class="stadium-title">
            <span>${leagueName(state)} · SPIELTAG ${state.career.week}</span>
            <div class="stadium-fixture">
              <div><i class="stadium-crest home-crest">${state.career.teamName.charAt(0)}</i><strong>${state.career.teamName}</strong></div>
              <b>VS</b>
              <div><i class="stadium-crest away-crest">${opponent.charAt(0)}</i><strong>${opponent}</strong></div>
            </div>
            <p>Die Mannschaften betreten den Rasen</p>
          </div>
          <div class="stadium-progress"><span id="stadium-progress-bar"></span></div>
          <button class="stadium-skip" type="button" onclick="App.skipStadiumIntro()">Zum Anstoss →</button>
        </div>
      </div>
    `);
    liveMatch.introTimer = setTimeout(skipStadiumIntro, 6500);
    liveMatch.raf = requestAnimationFrame(stadiumIntroFrame);
  }

  function showFootballKickoff(opponent) {
    render(`
      <div class="screen live-match-screen">
        ${renderHUD()}
        <div class="card live-match-card">
          <div class="live-scorebar">
            <div><small>HEIM</small><strong>${state.career.teamName}</strong></div>
            <div class="live-score"><span id="live-home-score">0</span><i>:</i><span id="live-away-score">0</span></div>
            <div class="live-away"><small>GAST</small><strong>${opponent}</strong></div>
          </div>
          <div class="live-pitch-wrap">
            <canvas id="football-canvas" width="960" height="540" aria-label="Spielbares Fussballfeld"></canvas>
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
                <button class="touch-action touch-sprint" id="touch-sprint" type="button">SPRINT</button>
                <button class="touch-action touch-shoot" id="touch-shoot" type="button"><span>⚽</span>SCHIESSEN</button>
              </div>
            </div>
          </div>
          <div class="live-controls">
            <span><kbd>WASD</kbd> oder Pfeiltasten: bewegen</span>
            <span><kbd>SHIFT</kbd> sprinten</span>
            <span><kbd>LEERTASTE</kbd> schiessen</span>
            <b id="live-clock">00:00</b>
          </div>
          <button class="btn btn-ghost btn-sm live-cancel" onclick="App.abandonFootballMatch()">Spiel abbrechen</button>
        </div>
      </div>
    `);
    liveMatch = { opponent, phase: 'ready', keys: new Set(), raf: null, cleanup: null };
    requestAnimationFrame(() => drawFootballPreview());
  }

  function skipStadiumIntro() {
    const match=liveMatch;
    if(!match||match.phase!=='intro')return;
    if(match.raf)cancelAnimationFrame(match.raf);
    if(match.introTimer)clearTimeout(match.introTimer);
    showFootballKickoff(match.opponent);
  }

  function stadiumIntroFrame(now) {
    const match=liveMatch,canvas=document.getElementById('stadium-intro-canvas');
    if(!match||match.phase!=='intro'||!canvas)return;
    const progress=Math.min(1,(now-match.introStart)/6000);
    drawStadiumIntro(canvas.getContext('2d'),canvas.width,canvas.height,progress,now/1000);
    const bar=document.getElementById('stadium-progress-bar');if(bar)bar.style.width=`${progress*100}%`;
    match.raf=requestAnimationFrame(stadiumIntroFrame);
  }

  function drawStadiumIntro(context,w,h,progress,time) {
    const sky=context.createLinearGradient(0,0,0,h*.55);sky.addColorStop(0,'#07101c');sky.addColorStop(1,'#172c35');context.fillStyle=sky;context.fillRect(0,0,w,h);
    [[115,72],[1085,72]].forEach(([x,y])=>{const glow=context.createRadialGradient(x,y,0,x,y,210);glow.addColorStop(0,'rgba(240,248,255,.48)');glow.addColorStop(.18,'rgba(190,220,255,.13)');glow.addColorStop(1,'rgba(140,190,255,0)');context.fillStyle=glow;context.fillRect(x-220,y-220,440,440);context.fillStyle='#eff7ff';for(let i=0;i<6;i++)for(let j=0;j<3;j++)context.fillRect(x-30+i*12,y-12+j*12,7,7);});
    context.fillStyle='#1d252b';context.beginPath();context.moveTo(0,112);context.lineTo(w,112);context.lineTo(w,455);context.quadraticCurveTo(w/2,350,0,455);context.closePath();context.fill();
    context.fillStyle='#303a40';context.beginPath();context.moveTo(0,150);context.lineTo(w,150);context.lineTo(w,382);context.quadraticCurveTo(w/2,305,0,382);context.closePath();context.fill();
    context.fillStyle='#11191e';context.fillRect(0,275,w,24);
    const crowdColors=['#e9edf0','#dfff53','#cf4141','#4774d8','#f2b84b'];
    for(let row=0;row<10;row++)for(let col=0;col<82;col++){const x=col*(w/81)+(row%2)*5,y=158+row*20+Math.sin(col*.71+row+time*2)*1.8;context.fillStyle=crowdColors[(col*3+row*7)%crowdColors.length];context.globalAlpha=.68;context.beginPath();context.arc(x,y,2.8+(row*.08),0,Math.PI*2);context.fill();}
    context.globalAlpha=1;
    const grass=context.createLinearGradient(0,315,0,h);grass.addColorStop(0,'#347d42');grass.addColorStop(1,'#174c2d');context.fillStyle=grass;context.beginPath();context.moveTo(290,310);context.lineTo(910,310);context.lineTo(1200,675);context.lineTo(0,675);context.closePath();context.fill();
    for(let i=0;i<9;i++){context.fillStyle=i%2?'rgba(255,255,255,.025)':'rgba(0,0,0,.055)';const topX=290+i*620/9,bottomX=i*w/9;context.beginPath();context.moveTo(topX,310);context.lineTo(topX+620/9,310);context.lineTo(bottomX+w/9,675);context.lineTo(bottomX,675);context.closePath();context.fill();}
    context.strokeStyle='rgba(255,255,255,.7)';context.lineWidth=3;context.beginPath();context.moveTo(290,310);context.lineTo(0,675);context.moveTo(910,310);context.lineTo(1200,675);context.moveTo(600,310);context.lineTo(600,675);context.stroke();
    context.fillStyle='#0a0d0f';context.beginPath();context.moveTo(520,294);context.lineTo(680,294);context.lineTo(700,388);context.lineTo(500,388);context.closePath();context.fill();context.strokeStyle='#69737a';context.lineWidth=5;context.stroke();
    const walk=Math.min(1,progress*1.35),bob=Math.sin(time*8)*2;
    for(let i=0;i<6;i++){const reveal=Math.max(0,Math.min(1,(walk-i*.075)/.62));if(reveal<=0)continue;const y=340+reveal*(235+i*10),spread=reveal*145;drawStadiumPerson(context,570-spread-i*5,y+bob*(i%2?1:-1),'home',i===0,1+reveal*.35);drawStadiumPerson(context,630+spread+i*5,y-bob*(i%2?1:-1),'away',i===0,1+reveal*.35);}
    const vignette=context.createRadialGradient(w/2,h*.56,150,w/2,h*.56,700);vignette.addColorStop(.55,'rgba(0,0,0,0)');vignette.addColorStop(1,'rgba(0,0,0,.7)');context.fillStyle=vignette;context.fillRect(0,0,w,h);
  }

  function drawStadiumPerson(context,x,y,team,keeper,scale) {
    const kit=keeper?'#f2a900':team==='home'?'#dfff53':'#4267d6',trim=team==='home'?'#132016':'#e2e8ff',skin=team==='home'?'#d8a378':'#966247';
    context.save();context.translate(x,y);context.scale(scale,scale);context.fillStyle='rgba(0,0,0,.28)';context.beginPath();context.ellipse(0,16,14,5,0,0,Math.PI*2);context.fill();
    context.strokeStyle=skin;context.lineWidth=5;context.lineCap='round';context.beginPath();context.moveTo(-9,-3);context.lineTo(-18,8);context.moveTo(9,-3);context.lineTo(18,8);context.stroke();
    context.strokeStyle=trim;context.lineWidth=7;context.beginPath();context.moveTo(-5,16);context.lineTo(-8,30);context.moveTo(5,16);context.lineTo(8,30);context.stroke();
    context.fillStyle=kit;context.beginPath();context.roundRect(-12,-12,24,31,7);context.fill();context.fillStyle=trim;context.fillRect(-12,7,24,4);
    context.fillStyle=skin;context.beginPath();context.arc(0,-21,9,0,Math.PI*2);context.fill();context.fillStyle='#281b15';context.beginPath();context.arc(0,-24,8,Math.PI,Math.PI*2);context.fill();context.restore();
  }

  function drawFootballPreview() {
    const canvas = document.getElementById('football-canvas');
    if (!canvas || !liveMatch) return;
    const context = canvas.getContext('2d');
    drawFootballPitch(context, canvas.width, canvas.height);
    const preview = [
      {x:110,y:270,team:'home',keeper:true,number:1,facing:0}, {x:310,y:170,team:'home',number:10,facing:0}, {x:390,y:350,team:'home',number:8,facing:0},
      {x:850,y:270,team:'away',keeper:true,number:1,facing:Math.PI}, {x:650,y:170,team:'away',number:9,facing:Math.PI}, {x:570,y:350,team:'away',number:6,facing:Math.PI}
    ];
    preview.forEach((p, i) => drawFootballer(context, p, i === 1));
    drawFootball(context, {x:480,y:270,r:8});
  }

  function startFootballMatch() {
    if (!liveMatch || liveMatch.phase !== 'ready') return;
    const canvas = document.getElementById('football-canvas');
    const kickoff = document.getElementById('live-kickoff');
    if (!canvas) return;
    kickoff?.remove();

    const human = {x:300,y:270,homeX:300,homeY:270,team:'home',r:14,vx:0,vy:0,human:true,cooldown:0,number:10,facing:0,stride:0};
    const players = [
      {x:105,y:270,homeX:105,homeY:270,team:'home',r:17,keeper:true,cooldown:0,number:1,facing:0,stride:0},
      human,
      {x:360,y:150,homeX:360,homeY:150,team:'home',r:14,cooldown:0,number:8,facing:0,stride:0},
      {x:855,y:270,homeX:855,homeY:270,team:'away',r:17,keeper:true,cooldown:0,number:1,facing:Math.PI,stride:0},
      {x:660,y:270,homeX:660,homeY:270,team:'away',r:14,cooldown:0,number:9,facing:Math.PI,stride:0},
      {x:600,y:390,homeX:600,homeY:390,team:'away',r:14,cooldown:0,number:6,facing:Math.PI,stride:0},
    ];
    Object.assign(liveMatch, {
      phase:'playing', canvas, context:canvas.getContext('2d'), players, human,
      ball:{x:480,y:270,r:8,vx:0,vy:0,owner:null}, score:{home:0,away:0},
      events:[], elapsed:0, last:performance.now(), resetUntil:0,
      touch:{x:0,y:0,sprint:false,pointerId:null}
    });

    const down = e => {
      liveMatch?.keys.add(e.code);
      if (['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)) e.preventDefault();
      if (e.code === 'Space') footballShoot(liveMatch?.human);
    };
    const up = e => liveMatch?.keys.delete(e.code);
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    const cleanupTouch = setupTouchGamepad(liveMatch);
    liveMatch.cleanup = () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); cleanupTouch(); };
    footballFrame(performance.now());
  }

  function footballFrame(now) {
    const m = liveMatch;
    if (!m || m.phase !== 'playing') return;
    const dt = Math.min(.035, Math.max(0, (now - m.last) / 1000));
    m.last = now;
    updateFootballMatch(m, dt);
    drawFootballMatch(m);
    if (m.phase === 'playing') m.raf = requestAnimationFrame(footballFrame);
  }

  function updateFootballMatch(m, dt) {
    if (m.resetUntil > performance.now()) return;
    m.elapsed += dt;
    if (m.elapsed >= 60) return finishFootballMatch();

    const k = m.keys;
    let dx = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0);
    let dy = (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0) - (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0);
    if (Math.hypot(m.touch.x,m.touch.y) > .08) { dx=m.touch.x; dy=m.touch.y; }
    const length = Math.hypot(dx,dy) || 1;
    const speed = k.has('ShiftLeft') || k.has('ShiftRight') || m.touch.sprint ? 225 : 170;
    m.human.vx = dx/length*speed; m.human.vy = dy/length*speed;

    m.players.forEach(p => {
      p.cooldown = Math.max(0, p.cooldown - dt);
      if (!p.human) updateFootballAI(m, p);
      const movement=Math.hypot(p.vx||0,p.vy||0);
      if(movement>4){p.facing=Math.atan2(p.vy,p.vx);p.stride=(p.stride||0)+dt*movement*.08;}
      p.x = clamp(p.x + (p.vx || 0)*dt, 48+p.r, 912-p.r);
      p.y = clamp(p.y + (p.vy || 0)*dt, 34+p.r, 506-p.r);
    });

    updateFootballBall(m, dt);
    const matchMinute = Math.min(90, Math.floor(m.elapsed * 1.5));
    const clock = document.getElementById('live-clock');
    if (clock) clock.textContent = `${String(matchMinute).padStart(2,'0')}:${String(Math.floor((m.elapsed*90)%60)).padStart(2,'0')}`;
  }

  function updateFootballAI(m, p) {
    let tx=p.homeX, ty=p.homeY, speed=115;
    if (p.keeper) {
      tx = p.team === 'home' ? 92 : 868;
      ty = clamp(m.ball.y, 205, 335);
    } else if (m.ball.owner === p) {
      tx = p.team === 'home' ? 930 : 30; ty=270; speed=142;
      if (Math.abs(tx-p.x) < 230 && p.cooldown <= 0) footballShoot(p);
    } else if (!m.ball.owner || m.ball.owner.team !== p.team) {
      const mates=m.players.filter(q=>q.team===p.team&&!q.keeper);
      const nearest=mates.reduce((a,b)=>footballDistance(a,m.ball)<footballDistance(b,m.ball)?a:b);
      if (nearest===p) { tx=m.ball.x; ty=m.ball.y; speed=155; }
    }
    const d=Math.hypot(tx-p.x,ty-p.y)||1;
    p.vx=(tx-p.x)/d*speed; p.vy=(ty-p.y)/d*speed;
  }

  function updateFootballBall(m, dt) {
    const b=m.ball;
    if (b.owner) {
      const p=b.owner;
      b.x=p.x+(p.team==='home'?p.r+7:-p.r-7); b.y=p.y+2;
      for (const q of m.players) {
        if (q.team!==p.team && footballDistance(q,p)<q.r+p.r+3 && q.cooldown<=0) {
          q.cooldown=.65; p.cooldown=.3; b.owner=q; break;
        }
      }
      return;
    }
    b.x+=b.vx*dt; b.y+=b.vy*dt;
    const drag=Math.pow(.985,dt*60); b.vx*=drag; b.vy*=drag;
    if (b.y<34+b.r||b.y>506-b.r) { b.vy*=-.75; b.y=clamp(b.y,34+b.r,506-b.r); }
    const inGoal=b.y>205&&b.y<335;
    if (b.x<48&&inGoal) return footballGoal('away');
    if (b.x>912&&inGoal) return footballGoal('home');
    if (b.x<48+b.r||b.x>912-b.r) { b.vx*=-.75; b.x=clamp(b.x,48+b.r,912-b.r); }
    for (const p of m.players) {
      if (footballDistance(p,b)<p.r+b.r+3 && Math.hypot(b.vx,b.vy)<300 && p.cooldown<=0) { b.owner=p; break; }
    }
  }

  function footballShoot(player) {
    const m=liveMatch;
    if (!m || !player || m.ball.owner!==player) return;
    const tx=player.team==='home'?940:20, ty=270+rand(-65,65);
    const d=Math.hypot(tx-player.x,ty-player.y)||1;
    m.ball.owner=null; m.ball.vx=(tx-player.x)/d*500; m.ball.vy=(ty-player.y)/d*500; player.cooldown=.5;
  }

  function setupTouchGamepad(match) {
    const joystick=document.getElementById('touch-joystick');
    const knob=document.getElementById('touch-joystick-knob');
    const sprint=document.getElementById('touch-sprint');
    const shoot=document.getElementById('touch-shoot');
    if(!joystick||!knob||!sprint||!shoot)return()=>{};
    const moveJoystick=e=>{
      if(match.touch.pointerId!==e.pointerId)return;
      e.preventDefault();
      const rect=joystick.getBoundingClientRect(),cx=rect.left+rect.width/2,cy=rect.top+rect.height/2;
      const max=rect.width*.31,rawX=e.clientX-cx,rawY=e.clientY-cy,d=Math.hypot(rawX,rawY)||1,scale=Math.min(1,max/d);
      const x=rawX*scale,y=rawY*scale;
      match.touch.x=x/max;match.touch.y=y/max;knob.style.transform=`translate(${x}px,${y}px)`;
    };
    const startJoystick=e=>{e.preventDefault();match.touch.pointerId=e.pointerId;joystick.setPointerCapture(e.pointerId);moveJoystick(e);};
    const endJoystick=e=>{if(match.touch.pointerId!==e.pointerId)return;match.touch.pointerId=null;match.touch.x=0;match.touch.y=0;knob.style.transform='translate(0,0)';};
    const sprintOn=e=>{e.preventDefault();match.touch.sprint=true;sprint.classList.add('pressed');sprint.setPointerCapture?.(e.pointerId);};
    const sprintOff=()=>{match.touch.sprint=false;sprint.classList.remove('pressed');};
    const shootBall=e=>{e.preventDefault();shoot.classList.add('pressed');footballShoot(match.human);setTimeout(()=>shoot.classList.remove('pressed'),120);};
    joystick.addEventListener('pointerdown',startJoystick);joystick.addEventListener('pointermove',moveJoystick);joystick.addEventListener('pointerup',endJoystick);joystick.addEventListener('pointercancel',endJoystick);
    sprint.addEventListener('pointerdown',sprintOn);sprint.addEventListener('pointerup',sprintOff);sprint.addEventListener('pointercancel',sprintOff);
    shoot.addEventListener('pointerdown',shootBall);
    return()=>{joystick.removeEventListener('pointerdown',startJoystick);joystick.removeEventListener('pointermove',moveJoystick);joystick.removeEventListener('pointerup',endJoystick);joystick.removeEventListener('pointercancel',endJoystick);sprint.removeEventListener('pointerdown',sprintOn);sprint.removeEventListener('pointerup',sprintOff);sprint.removeEventListener('pointercancel',sprintOff);shoot.removeEventListener('pointerdown',shootBall);};
  }

  function footballGoal(team) {
    const m=liveMatch;
    if (!m || m.phase!=='playing') return;
    m.score[team]++;
    const minute=Math.min(90,Math.max(1,Math.round(m.elapsed*1.5)));
    m.events.push({minute,text:team==='home'?'Tor für dein Team! ⚽':'Gegentor 😤',type:team==='home'?'player':'opponent'});
    const scoreEl=document.getElementById(`live-${team}-score`); if(scoreEl)scoreEl.textContent=m.score[team];
    const message=document.getElementById('live-message');
    if(message){message.textContent=team==='home'?'TOR!':'GEGENTOR';message.classList.add('show');setTimeout(()=>message.classList.remove('show'),1000);}
    m.resetUntil=performance.now()+1500;
    setTimeout(()=>resetFootballPositions(team==='home'?'away':'home'),1250);
  }

  function resetFootballPositions(kickoffTeam) {
    const m=liveMatch; if(!m||m.phase!=='playing')return;
    m.players.forEach(p=>{p.x=p.homeX;p.y=p.homeY;p.vx=p.vy=0;});
    Object.assign(m.ball,{x:480,y:270,vx:0,vy:0,owner:m.players.find(p=>p.team===kickoffTeam&&!p.keeper)});
    m.resetUntil=0;
  }

  function finishFootballMatch() {
    const m=liveMatch; if(!m||m.phase!=='playing')return;
    m.phase='finished'; if(m.raf)cancelAnimationFrame(m.raf); m.cleanup?.();
    const result=m.score.home>m.score.away?'win':m.score.home<m.score.away?'loss':'draw';
    const c=state.career,p=state.player;
    if(result==='win')c.wins++; else if(result==='loss')c.losses++; else c.draws++;
    const money=(result==='win'?rand(800,2000):result==='draw'?rand(200,600):rand(100,400))*(c.leagueIndex+1);
    const personal=m.score.home>0?rand(0,m.score.home):0;
    const assists=Math.max(0,m.score.home-personal);
    c.goals+=personal;c.assists+=assists;c.bestMatchGoals=Math.max(c.bestMatchGoals,personal);
    p.money+=money;p.totalEarned+=money;p.energy=clamp(p.energy-rand(15,30),0,100);
    p.morale=result==='win'?clamp(p.morale+rand(5,15),0,100):result==='loss'?clamp(p.morale-rand(5,12),0,100):p.morale;
    p.fame+=result==='win'?rand(3,8):rand(0,2);c.week++;if(c.week>c.weeksPerSeason)endSeason();
    const matchResult={playerGoals:m.score.home,oppGoals:m.score.away,result,opponent:m.opponent,events:m.events,money,personal,assists,score:`${m.score.home} : ${m.score.away}`};
    const type=result==='win'?'good':result==='loss'?'bad':'neutral';
    addLog(`${result==='win'?'Sieg':result==='draw'?'Unentschieden':'Niederlage'} gegen ${m.opponent} (${matchResult.score})`,type);
    saveGame();checkAchievements().forEach(a=>setTimeout(()=>showAchievement(a),600));saveGame();
    liveMatch=null;showMatch(matchResult);
  }

  function abandonFootballMatch() {
    if(liveMatch?.raf)cancelAnimationFrame(liveMatch.raf);liveMatch?.cleanup?.();liveMatch=null;showHub('home');
  }

  function footballDistance(a,b){return Math.hypot(a.x-b.x,a.y-b.y);}

  function drawFootballMatch(m) {
    drawFootballPitch(m.context,960,540);m.players.forEach(p=>drawFootballer(m.context,p,p.human));drawFootball(m.context,m.ball);
  }

  function drawFootballPitch(context,w,h) {
    const gradient=context.createLinearGradient(0,0,w,h);gradient.addColorStop(0,'#31733b');gradient.addColorStop(1,'#20542f');context.fillStyle=gradient;context.fillRect(0,0,w,h);
    for(let i=0;i<10;i++){context.fillStyle=i%2?'rgba(255,255,255,.025)':'rgba(0,0,0,.035)';context.fillRect(i*w/10,0,w/10,h);}
    context.strokeStyle='rgba(255,255,255,.72)';context.lineWidth=2;context.strokeRect(48,34,864,472);
    context.beginPath();context.moveTo(480,34);context.lineTo(480,506);context.stroke();context.beginPath();context.arc(480,270,62,0,Math.PI*2);context.stroke();
    context.strokeRect(48,160,120,220);context.strokeRect(792,160,120,220);context.strokeRect(48,205,45,130);context.strokeRect(867,205,45,130);
    context.fillStyle='rgba(8,14,10,.45)';context.fillRect(32,205,16,130);context.fillRect(912,205,16,130);
  }

  function drawFootballer(context,p,selected) {
    const angle=Number.isFinite(p.facing)?p.facing:(p.team==='home'?0:Math.PI);
    const moving=Math.hypot(p.vx||0,p.vy||0)>8;
    const step=moving?Math.sin(p.stride||0)*3:0;
    const kit=p.keeper?'#f2a900':p.team==='home'?'#dfff53':'#4267d6';
    const trim=p.keeper?'#211b0c':p.team==='home'?'#142016':'#d5ddff';
    const skin=p.team==='home'?'#d7a071':'#9a6548';
    context.save();context.translate(p.x,p.y);context.rotate(angle);
    context.fillStyle='rgba(0,0,0,.3)';context.beginPath();context.ellipse(-2,7,p.r+7,p.r*.72,0,0,Math.PI*2);context.fill();
    context.strokeStyle=trim;context.lineWidth=5;context.lineCap='round';
    context.beginPath();context.moveTo(-8,-3);context.lineTo(-15,-10+step);context.moveTo(-8,4);context.lineTo(-15,12-step);context.stroke();
    context.strokeStyle=skin;context.lineWidth=4;
    context.beginPath();context.moveTo(0,-8);context.lineTo(3,-17-step*.35);context.moveTo(0,8);context.lineTo(3,17+step*.35);context.stroke();
    context.fillStyle=kit;context.strokeStyle=trim;context.lineWidth=2;context.beginPath();context.moveTo(-10,-10);context.quadraticCurveTo(2,-14,10,-8);context.lineTo(10,8);context.quadraticCurveTo(2,14,-10,10);context.closePath();context.fill();context.stroke();
    context.fillStyle=trim;context.font='800 8px system-ui';context.textAlign='center';context.textBaseline='middle';context.fillText(String(p.number||7),0,0);
    context.fillStyle=skin;context.strokeStyle='rgba(44,26,17,.75)';context.lineWidth=1.5;context.beginPath();context.arc(12,0,p.r*.47,0,Math.PI*2);context.fill();context.stroke();
    context.fillStyle='#332319';context.beginPath();context.arc(13,0,p.r*.38,Math.PI*.75,Math.PI*1.25);context.lineTo(12,0);context.fill();
    context.fillStyle=trim;context.beginPath();context.ellipse(-16,-10+step,4,2.6,0,0,Math.PI*2);context.ellipse(-16,12-step,4,2.6,0,0,Math.PI*2);context.fill();
    context.restore();
    if(selected){context.strokeStyle='#fff';context.lineWidth=2;context.beginPath();context.arc(p.x,p.y,p.r+10,0,Math.PI*2);context.stroke();context.fillStyle='#fff';context.beginPath();context.moveTo(p.x-5,p.y-p.r-16);context.lineTo(p.x+5,p.y-p.r-16);context.lineTo(p.x,p.y-p.r-9);context.fill();}
  }

  function drawFootball(context,b) {
    context.fillStyle='rgba(0,0,0,.3)';context.beginPath();context.ellipse(b.x+2,b.y+5,b.r+2,b.r*.55,0,0,Math.PI*2);context.fill();context.fillStyle='#fff';context.beginPath();context.arc(b.x,b.y,b.r,0,Math.PI*2);context.fill();context.fillStyle='#111';context.beginPath();context.arc(b.x,b.y,2.5,0,Math.PI*2);context.fill();
  }

  function endSeason() {
    const c = state.career;
    const p = state.player;
    c.week = 1;
    c.season++;
    c.seasons++;
    p.age++;
    p.skillPoints += 2;
    p.energy = 100;
    p.morale = clamp(p.morale + 10, 0, 100);

    // Promotion / Relegation
    const winRate = c.wins / Math.max(c.wins + c.losses + c.draws, 1);
    if (winRate >= 0.55 && c.leagueIndex < CONFIG[state.sport].leagues.length - 1) {
      c.leagueIndex++;
      c.promotions++;
      // New team
      const teams = CONFIG[state.sport].teamNames;
      c.teamName = teams[rand(Math.min(c.leagueIndex * 2, teams.length - 3), Math.min(c.leagueIndex * 2 + 4, teams.length - 1))];
      addLog(`Aufgestiegen! Jetzt in der ${leagueName(state)} 🎉`, 'special');
    } else if (winRate < 0.3 && c.leagueIndex > 0) {
      c.leagueIndex--;
      c.relegations++;
      addLog(`Abgestiegen in die ${leagueName(state)} 😤`, 'bad');
    } else {
      addLog(`Saison ${c.season - 1} abgeschlossen. Bleibst in der ${leagueName(state)}.`, 'neutral');
    }

    // Reset season stats
    c.wins = 0; c.losses = 0; c.draws = 0;
    c.seasonLog = [];

    // Bonus money
    const bonus = rand(2000, 8000) * (c.leagueIndex + 1);
    p.money += bonus;
    p.totalEarned += bonus;
  }

  // ── TRAINING ──────────────────────────────────────
  function doTraining(stat) {
    const p = state.player;
    if (p.energy < 20) return { ok: false, msg: 'Zu wenig Energie! Erst ausruhen.' };
    const gain = rand(2, 6);
    p.stats[stat] = clamp(p.stats[stat] + gain, 1, 99);
    p.energy = clamp(p.energy - rand(10, 20), 0, 100);
    p.money -= 50;
    state.career.week++;
    if (state.career.week > state.career.weeksPerSeason) endSeason();
    addLog(`Training: ${stat} +${gain}`, 'good');
    return { ok: true, gain, stat };
  }

  function doRest() {
    const p = state.player;
    const energyGain = rand(25, 45);
    const moraleGain = rand(5, 15);
    p.energy = clamp(p.energy + energyGain, 0, 100);
    p.morale = clamp(p.morale + moraleGain, 0, 100);
    state.career.week++;
    if (state.career.week > state.career.weeksPerSeason) endSeason();
    addLog(`Erholt. Energie +${energyGain}, Moral +${moraleGain}`, 'neutral');
  }

  function spendSkillPoint(stat) {
    const p = state.player;
    if (p.skillPoints <= 0) return false;
    p.stats[stat] = clamp(p.stats[stat] + rand(4, 8), 1, 99);
    p.skillPoints--;
    return true;
  }

  // ─────────────────────────────────────────────────
  // RENDER FUNCTIONS
  // ─────────────────────────────────────────────────

  const app = document.getElementById('app');
  function render(html) { app.innerHTML = html; }

  // ── HUD ──────────────────────────────────────────
  function renderHUD() {
    const p = state.player;
    const c = state.career;
    const cfg = CONFIG[state.sport];
    return `
      <div class="hud">
        <div class="hud-name">${p.name} <span class="hud-sport ${state.sport}">${cfg.icon} ${cfg.name}</span></div>
        <div class="hud-block"><div class="hud-label">Liga</div><div class="hud-value">${leagueName(state)}</div></div>
        <div class="hud-block"><div class="hud-label">Saison</div><div class="hud-value">${c.season}</div></div>
        <div class="hud-block"><div class="hud-label">Woche</div><div class="hud-value">${c.week}/${c.weeksPerSeason}</div></div>
        <div class="hud-block"><div class="hud-label">Alter</div><div class="hud-value">${p.age}</div></div>
        <div class="hud-block"><div class="hud-label">Energie</div><div class="hud-value ${p.energy < 30 ? 'bad' : ''}">${p.energy}%</div></div>
        <div class="hud-block"><div class="hud-label">Geld</div><div class="hud-value">€${fmt(p.money)}</div></div>
      </div>
    `;
  }

  function renderSeasonBar() {
    const c = state.career;
    const pct = Math.round((c.week - 1) / c.weeksPerSeason * 100);
    const total = c.wins + c.losses + c.draws;
    return `
      <div class="card">
        <div style="display:flex;justify-content:space-between;margin-bottom:6px">
          <span style="font-size:.85rem;color:var(--muted)">Saisonfortschritt</span>
          <span style="font-size:.85rem">${c.wins}S ${c.draws}U ${c.losses}N</span>
        </div>
        <div class="season-progress"><div class="season-fill" style="width:${pct}%"></div></div>
        <div style="font-size:.75rem;color:var(--muted);margin-top:4px">${c.teamName} • ${total} Spiele</div>
      </div>
    `;
  }

  // ── SCREEN: TITLE ─────────────────────────────────
  function showTitle() {
    const saved = loadGame();
    render(`
      <div class="screen title-screen">
        <h1>🏟️ Sports Career</h1>
        <p class="subtitle">Starte deine Karriere als Profi-Sportler</p>
        <div class="sport-cards">
          <div class="sport-card football" onclick="App.showCreate('football')">
            <span class="sport-icon">⚽</span>
            <h2>Fussball</h2>
            <p>Kreisliga bis Champions League</p>
          </div>
          <div class="sport-card basketball" onclick="App.showCreate('basketball')">
            <span class="sport-icon">🏀</span>
            <h2>Basketball</h2>
            <p>Street League bis NBA</p>
          </div>
        </div>
        ${saved ? `
        <div style="margin-top:32px">
          <div class="card" style="max-width:360px;margin:0 auto">
            <div style="font-size:.85rem;color:var(--muted);margin-bottom:10px">💾 Gespeicherter Spielstand</div>
            <div style="font-weight:700">${saved.player.name} – ${CONFIG[saved.sport].name}</div>
            <div style="color:var(--muted);font-size:.85rem">${CONFIG[saved.sport].leagues[saved.career.leagueIndex]} • Saison ${saved.career.season} • Alter ${saved.player.age}</div>
            <div style="display:flex;gap:10px;margin-top:14px">
              <button class="btn btn-primary" onclick="App.continueGame()">Weiterspielen</button>
              <button class="btn btn-ghost btn-sm" onclick="App.confirmNewGame()">Neues Spiel</button>
            </div>
          </div>
        </div>` : ''}
      </div>
    `);
  }

  // ── SCREEN: CREATE PLAYER ─────────────────────────
  function showCreate(sport) {
    const cfg = CONFIG[sport];
    const posHtml = cfg.positions.map((pos, i) =>
      `<div class="pos-btn${i === 0 ? ' selected' : ''}" onclick="selectPos(this,'${pos}')" data-pos="${pos}">${pos}</div>`
    ).join('');
    render(`
      <div class="screen create-screen">
        <div class="card">
          <h2>${cfg.icon} Neuer ${cfg.name}-Spieler</h2>
          <div class="form-row">
            <div class="form-group">
              <label>Vorname</label>
              <input type="text" id="inp-first" placeholder="Max" value="Max">
            </div>
            <div class="form-group">
              <label>Nachname</label>
              <input type="text" id="inp-last" placeholder="Mustermann" value="Mustermann">
            </div>
          </div>
          <div class="form-group">
            <label>Position</label>
            <div class="position-grid" id="pos-grid">${posHtml}</div>
            <input type="hidden" id="inp-pos" value="${cfg.positions[0]}">
          </div>
          <div style="display:flex;gap:12px;margin-top:20px">
            <button class="btn btn-ghost" onclick="App.showTitle()">← Zurück</button>
            <button class="btn btn-primary" onclick="App.startGame('${sport}')">Karriere starten 🚀</button>
          </div>
        </div>
      </div>
    `);
    // inline helper
    window.selectPos = (el, pos) => {
      document.querySelectorAll('.pos-btn').forEach(b => b.classList.remove('selected'));
      el.classList.add('selected');
      document.getElementById('inp-pos').value = pos;
    };
  }

  // ── SCREEN: MAIN HUB ─────────────────────────────
  function showHub(activeTab = 'home') {
    const p = state.player;
    const c = state.career;
    const cfg = CONFIG[state.sport];

    const tabs = ['home', 'stats', 'log', 'achievements'].map(t => `
      <button class="tab ${t === activeTab ? 'active' : ''}" onclick="App.showHub('${t}')">${
        { home: '🏠 Übersicht', stats: '📊 Stats', log: '📋 Log', achievements: '🏆 Erfolge' }[t]
      }</button>`).join('');

    let content = '';

    if (activeTab === 'home') {
      const energy = p.energy;
      const canPlay = energy >= 15;
      const canTrain = energy >= 20;

      const trainHtml = cfg.stats.map(s => `
        <div class="action-card" onclick="App.train('${s}')">
          <span class="action-icon">💪</span>
          <div class="action-name">${s}</div>
          <div class="action-desc">Aktuell: ${p.stats[s]}</div>
          <div class="action-cost">-20 Energie • -€50</div>
        </div>`).join('');

      content = `
        ${renderSeasonBar()}
        <div class="card">
          <h3 style="margin-bottom:16px">⚡ Aktionen</h3>
          <div class="actions-grid">
            <div class="action-card ${canPlay ? '' : 'disabled'}" onclick="${canPlay ? 'App.playMatch()' : ''}">
              <span class="action-icon">${cfg.icon}</span>
              <div class="action-name">Spiel spielen</div>
              <div class="action-desc">Gegen Liga-Gegner antreten</div>
              <div class="action-cost">${canPlay ? '-15–30 Energie' : '⚠️ Zu müde!'}</div>
            </div>
            <div class="action-card" onclick="App.doRest()">
              <span class="action-icon">😴</span>
              <div class="action-name">Ausruhen</div>
              <div class="action-desc">Energie & Moral erholen</div>
              <div class="action-cost">+25–45 Energie</div>
            </div>
          </div>
        </div>
        <div class="card">
          <h3 style="margin-bottom:16px">💪 Training <span style="color:var(--muted);font-size:.85rem">${canTrain ? '' : '(Energie zu niedrig!)'}</span></h3>
          <div class="actions-grid">${trainHtml}</div>
        </div>
        ${p.skillPoints > 0 ? `
        <div class="card" style="border-color:var(--gold)">
          <h3 style="margin-bottom:4px">⭐ ${p.skillPoints} Skillpunkte verfügbar!</h3>
          <p style="color:var(--muted);font-size:.85rem;margin-bottom:14px">Wähle einen Stat zum Boosten (+4–8 Punkte)</p>
          <div class="actions-grid">
            ${cfg.stats.map(s => `
              <div class="action-card" onclick="App.useSkillPoint('${s}')">
                <span class="action-icon">✨</span>
                <div class="action-name">${s}</div>
                <div class="action-desc">${p.stats[s]}/99</div>
              </div>`).join('')}
          </div>
        </div>` : ''}
      `;
    }

    if (activeTab === 'stats') {
      const statBars = cfg.stats.map(s => {
        const v = p.stats[s];
        return `
          <div class="stat-row">
            <div class="stat-name">${s}</div>
            <div class="stat-bar"><div class="stat-fill ${statColor(v)}" style="width:${v}%"></div></div>
            <div class="stat-num">${v}</div>
          </div>`;
      }).join('');

      content = `
        <div class="card">
          <h3 style="margin-bottom:4px">${p.name}</h3>
          <div style="color:var(--muted);font-size:.85rem;margin-bottom:20px">${p.position} • ${leagueName(state)} • Alter ${p.age}</div>
          <div style="margin-bottom:8px;color:var(--muted);font-size:.8rem;text-transform:uppercase;letter-spacing:.5px">Skills (Ø ${avgStat(p)})</div>
          ${statBars}
        </div>
        <div class="card">
          <table class="table">
            <tr><th>Kennzahl</th><th>Wert</th></tr>
            <tr><td>⚡ Energie</td><td>${p.energy}%</td></tr>
            <tr><td>😊 Moral</td><td>${p.morale}%</td></tr>
            <tr><td>⭐ Bekanntheit</td><td>${p.fame}</td></tr>
            <tr><td>💰 Geld</td><td>€${fmt(p.money)}</td></tr>
            <tr><td>💵 Gesamt verdient</td><td>€${fmt(p.totalEarned)}</td></tr>
            <tr><td>${cfg.icon} Tore/Punkte</td><td>${c.goals}</td></tr>
            <tr><td>🎯 Assists</td><td>${c.assists}</td></tr>
            <tr><td>✅ Siege (gesamt)</td><td>${c.wins}</td></tr>
            <tr><td>📈 Aufstiege</td><td>${c.promotions}</td></tr>
          </table>
        </div>
      `;
    }

    if (activeTab === 'log') {
      const logHtml = state.log.length === 0
        ? '<div style="color:var(--muted);padding:20px;text-align:center">Noch keine Aktivitäten</div>'
        : state.log.map(e => `<div class="log-entry ${e.type}"><span class="log-icon">${e.icon}</span><span>${e.msg}</span></div>`).join('');
      content = `<div class="card"><h3 style="margin-bottom:16px">📋 Spielprotokoll</h3><div class="log">${logHtml}</div></div>`;
    }

    if (activeTab === 'achievements') {
      const achHtml = ACHIEVEMENTS.map(a => {
        const done = state.achievements.includes(a.id);
        return `
          <div class="card" style="${done ? 'border-color:var(--gold)' : 'opacity:.5'}">
            <div style="display:flex;align-items:center;gap:14px">
              <span style="font-size:2rem">${a.icon}</span>
              <div>
                <div style="font-weight:700">${a.name} ${done ? '<span class="badge badge-gold">Unlocked</span>' : ''}</div>
                <div style="color:var(--muted);font-size:.85rem">${a.desc}</div>
              </div>
            </div>
          </div>`;
      }).join('');
      content = `<div>${achHtml}</div>`;
    }

    render(`
      <div class="screen">
        ${renderHUD()}
        <div class="tabs">${tabs}</div>
        ${content}
      </div>
    `);
  }

  // ── SCREEN: MATCH ─────────────────────────────────
  function showMatch(result) {
    const cfg = CONFIG[state.sport];
    const won = result.result === 'win';
    const drew = result.result === 'draw';
    const resultLabel = won ? '🎉 Sieg!' : drew ? '🤝 Unentschieden' : '😤 Niederlage';
    const resultColor = won ? 'var(--football)' : drew ? 'var(--gold)' : 'var(--danger)';

    const eventsHtml = result.events.map(e =>
      `<div class="match-event ${e.type}"><strong>${e.minute}'</strong> — ${e.text}</div>`
    ).join('');

    render(`
      <div class="screen">
        ${renderHUD()}
        <div class="card match-screen">
          <div style="font-size:1.5rem;font-weight:900;color:${resultColor}">${resultLabel}</div>
          <div style="color:var(--muted);font-size:.85rem;margin:6px 0">${state.career.teamName} vs ${result.opponent}</div>
          <div class="match-score">
            <span>${result.score.split(':')[0]}</span>
            <span style="color:var(--muted);font-size:1.5rem">:</span>
            <span>${result.score.split(':')[1]}</span>
          </div>
          <div style="display:flex;gap:24px;justify-content:center;margin-bottom:16px;flex-wrap:wrap">
            <div><span style="color:var(--muted);font-size:.8rem">Deine Tore/Punkte</span><br><strong>${result.personal}</strong></div>
            <div><span style="color:var(--muted);font-size:.8rem">Assists</span><br><strong>${result.assists}</strong></div>
            <div><span style="color:var(--muted);font-size:.8rem">Verdient</span><br><strong style="color:var(--gold)">+€${fmt(result.money)}</strong></div>
          </div>
          <div class="match-events">${eventsHtml}</div>
          <button class="btn btn-primary btn-block" onclick="App.showHub('home')">← Zurück zur Übersicht</button>
        </div>
      </div>
    `);
  }

  // ── PUBLIC API ────────────────────────────────────
  function startGame(sport) {
    const first = document.getElementById('inp-first')?.value.trim() || 'Max';
    const last = document.getElementById('inp-last')?.value.trim() || 'Mustermann';
    const pos = document.getElementById('inp-pos')?.value || CONFIG[sport].positions[0];
    const name = `${first} ${last}`;
    state = newState(sport, name, pos);
    addLog(`Karriere gestartet als ${pos} bei ${state.career.teamName}`, 'special');
    saveGame();
    showHub();
  }

  function continueGame() {
    state = loadGame();
    showHub();
  }

  function confirmNewGame() {
    const modal = document.createElement('div');
    modal.className = 'modal-bg';
    modal.innerHTML = `
      <div class="modal">
        <h3>⚠️ Neues Spiel?</h3>
        <p>Dein gespeicherter Fortschritt wird gelöscht. Wirklich neu starten?</p>
        <div class="modal-btns">
          <button class="btn btn-danger" onclick="App._doNewGame()">Ja, neu starten</button>
          <button class="btn btn-ghost" onclick="this.closest('.modal-bg').remove()">Abbrechen</button>
        </div>
      </div>`;
    document.body.appendChild(modal);
  }

  function _doNewGame() {
    clearSave();
    document.querySelector('.modal-bg')?.remove();
    state = null;
    showTitle();
  }

  function playMatch() {
    if (!state || state.player.energy < 15) {
      addLog('Zu müde für ein Spiel! Erst ausruhen.', 'bad');
      showHub('home');
      return;
    }
    if (state.sport === 'football') {
      showFootballMatch();
      return;
    }
    const result = simulateMatch();
    const type = result.result === 'win' ? 'good' : result.result === 'loss' ? 'bad' : 'neutral';
    addLog(`${result.result === 'win' ? 'Sieg' : result.result === 'draw' ? 'Unentschieden' : 'Niederlage'} gegen ${result.opponent} (${result.score})`, type);
    saveGame();
    const newAch = checkAchievements();
    newAch.forEach(a => setTimeout(() => showAchievement(a), 600));
    saveGame();
    showMatch(result);
  }

  function train(stat) {
    const res = doTraining(stat);
    if (!res.ok) { addLog(res.msg, 'bad'); }
    const newAch = checkAchievements();
    newAch.forEach(a => setTimeout(() => showAchievement(a), 400));
    saveGame();
    showHub('home');
  }

  function doRest() {
    if (!state) return;
    const p = state.player;
    const energyGain = rand(25, 45);
    const moraleGain = rand(5, 15);
    p.energy = clamp(p.energy + energyGain, 0, 100);
    p.morale = clamp(p.morale + moraleGain, 0, 100);
    state.career.week++;
    if (state.career.week > state.career.weeksPerSeason) endSeason();
    addLog(`Erholt. Energie +${energyGain}, Moral +${moraleGain}`, 'neutral');
    saveGame();
    showHub('home');
  }

  function useSkillPoint(stat) {
    if (!spendSkillPoint(stat)) return;
    addLog(`Skillpunkt eingesetzt: ${stat} geboostet!`, 'special');
    saveGame();
    showHub('home');
  }

  // ── INIT ──────────────────────────────────────────
  function init() {
    showTitle();
  }

  return {
    init,
    showTitle,
    showCreate,
    showHub,
    startGame,
    continueGame,
    confirmNewGame,
    _doNewGame,
    playMatch,
    skipStadiumIntro,
    startFootballMatch,
    abandonFootballMatch,
    train,
    doRest,
    useSkillPoint,
  };
})();

document.addEventListener('DOMContentLoaded', () => App.init());
