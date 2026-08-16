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
      // NBA-first: index 0 = G-League (relegation), index 1 = NBA (start)
      leagues: ['G-League', 'NBA'],
      startLeagueIndex: 1, // players start in NBA
      matchEvents: {
        player: ['3-Pointer! 🎯', 'Slam Dunk! 💥', 'No-Look Pass 😎', 'Steal + Layup ⚡', 'And-One! 🔥', 'Game-Winner! 🚨', 'Triple-Double night 📊'],
        opponent: ['Blocked! 🛡️', 'Turnover 😤', 'Foul Trouble ⚠️', 'Benched by coach 🪑'],
        neutral: ['Buzzer-Beater 🚨', 'Overtime! ⏱️', 'Technical Foul 😤', 'Timeout called ⏸️', 'Replay Review 📺'],
      },
      // Index 0: G-League teams, Index 1: NBA teams
      teamsByLeague: [
        // G-League
        ['Lakeland Magic', 'Westchester Knicks', 'Long Island Nets', 'Stockton Kings', 'Santa Cruz Warriors', 'Capital City Go-Go', 'Windy City Bulls', 'Cleveland Charge', 'Fort Wayne Mad Ants', 'Grand Rapids Gold', 'Iowa Wolves', 'Memphis Hustle', 'Motor City Cruise', 'Oklahoma City Blue', 'Osceola Magic', 'Raptors 905', 'Rio Grande Valley Vipers', 'Salt Lake City Stars', 'Sioux Falls Skyforce', 'South Bay Lakers', 'Spurs Austin', 'Texas Legends', 'Agua Caliente Clippers', 'Birmingham Squadron', 'Delaware Blue Coats'],
        // NBA
        ['Lakers', 'Celtics', 'Warriors', 'Bulls', 'Heat', 'Knicks', 'Nets', 'Bucks', 'Suns', 'Clippers', 'Nuggets', 'Mavericks', 'Spurs', 'Rockets', 'Thunder', 'Blazers', 'Jazz', 'Timberwolves', 'Kings', 'Pelicans', 'Grizzlies', 'Pacers', '76ers', 'Raptors', 'Cavaliers', 'Magic', 'Hornets', 'Hawks', 'Wizards', 'Pistons'],
      ],
      // kept for compat (used in team-pick fallback)
      teamNames: ['Lakers', 'Celtics', 'Warriors', 'Bulls', 'Heat', 'Knicks', 'Nets', 'Bucks', 'Suns', 'Clippers', 'Nuggets', 'Mavericks', 'Spurs', 'Rockets', 'Thunder', 'Blazers', 'Jazz', 'Timberwolves', 'Kings', 'Pelicans'],
    },
  };

  const ACHIEVEMENTS = [
    { id: 'first_win', name: 'Erster Sieg!', desc: 'Dein erstes Spiel gewonnen', icon: '🏆', check: s => s.career.wins >= 1 },
    { id: 'season1', name: 'Erstes Comeback', desc: 'Erste Saison abgeschlossen', icon: '📅', check: s => s.career.seasons >= 1 },
    { id: 'hat_trick', name: 'Hattrick-Held', desc: '3+ Tore in einem Spiel', icon: '⚽⚽⚽', check: s => s.career.bestMatchGoals >= 3 },
    { id: 'promoted', name: 'Aufsteiger', desc: 'Erste Liga-Beförderung', icon: '📈', check: s => s.career.promotions >= 1 },
    { id: 'mvp', name: 'MVP', desc: '10+ Spiele gewonnen', icon: '🌟', check: s => s.career.wins >= 10 },
    { id: 'legend', name: 'Legende', desc: 'Top-Liga erreicht', icon: '👑', check: s => s.sport === 'football' ? s.career.leagueIndex >= 5 : s.career.leagueIndex >= 1 },
    { id: 'nba_comeback', name: 'NBA Comeback', desc: 'Nach G-League wieder in die NBA aufgestiegen', icon: '💪', check: s => s.sport === 'basketball' && s.career.promotions >= 1 },
    { id: 'g_league', name: 'G-League Grind', desc: 'In die G-League abgestiegen', icon: '😤', check: s => s.sport === 'basketball' && s.career.relegations >= 1 },
    { id: 'nba_star', name: 'NBA Star', desc: '3 Saisons in der NBA überlebt', icon: '⭐', check: s => s.sport === 'basketball' && s.career.leagueIndex === 1 && s.career.seasons >= 3 },
    { id: 'max_contract', name: 'Max Contract', desc: '10 Mio. € verdient', icon: '💎', check: s => s.sport === 'basketball' && s.player.totalEarned >= 10000000 },
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
    const isBasketball = sport === 'basketball';
    const baseStats = {};
    // Basketball: start with higher stats (NBA-level rookie)
    cfg.stats.forEach(s => { baseStats[s] = isBasketball ? rand(45, 65) : rand(20, 40); });
    const startLeague = cfg.startLeagueIndex ?? 0;
    const startTeams = isBasketball ? cfg.teamsByLeague[startLeague] : cfg.teamNames;
    return {
      sport,
      player: {
        name: playerName,
        position,
        age: isBasketball ? rand(19, 22) : 17,
        energy: 100,
        morale: 75,
        fame: isBasketball ? rand(20, 40) : 0,
        money: isBasketball ? rand(500000, 2000000) : 500,
        totalEarned: isBasketball ? 0 : 0,
        stats: baseStats,
        skillPoints: isBasketball ? 2 : 3,
      },
      career: {
        leagueIndex: startLeague,
        teamName: startTeams[rand(0, startTeams.length - 1)],
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

    // Opponent name — for basketball use per-league team list
    const bbCfg = CONFIG[state.sport];
    const leagueTeams = bbCfg.teamsByLeague
      ? bbCfg.teamsByLeague[c.leagueIndex] || bbCfg.teamNames
      : bbCfg.teamNames;
    const oppNames = leagueTeams.filter(n => n !== c.teamName);
    const opponent = oppNames[rand(0, oppNames.length - 1)];

    // Result
    let result, money;
    const isNBA = state.sport === 'basketball' && state.career.leagueIndex === 1;
    const isGLeague = state.sport === 'basketball' && state.career.leagueIndex === 0;
    if (playerGoals > oppGoals) {
      result = 'win';
      c.wins++;
      money = isNBA ? rand(80000, 250000) : isGLeague ? rand(3000, 8000) : rand(800, 2000) * (c.leagueIndex + 1);
    } else if (playerGoals === oppGoals) {
      result = 'draw';
      c.draws++;
      money = isNBA ? rand(30000, 80000) : isGLeague ? rand(1000, 3000) : rand(200, 600) * (c.leagueIndex + 1);
    } else {
      result = 'loss';
      c.losses++;
      money = isNBA ? rand(15000, 50000) : isGLeague ? rand(500, 1500) : rand(100, 400) * (c.leagueIndex + 1);
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

  function drawFootballPreview() {
    const canvas = document.getElementById('football-canvas');
    if (!canvas || !liveMatch) return;
    const context = canvas.getContext('2d');
    drawFootballPitch(context, canvas.width, canvas.height);
    const preview = [
      {x:110,y:270,team:'home'}, {x:310,y:170,team:'home'}, {x:390,y:350,team:'home'},
      {x:850,y:270,team:'away'}, {x:650,y:170,team:'away'}, {x:570,y:350,team:'away'}
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

    const human = {x:300,y:270,homeX:300,homeY:270,team:'home',r:14,vx:0,vy:0,human:true,cooldown:0};
    const players = [
      {x:105,y:270,homeX:105,homeY:270,team:'home',r:17,keeper:true,cooldown:0},
      human,
      {x:360,y:150,homeX:360,homeY:150,team:'home',r:14,cooldown:0},
      {x:855,y:270,homeX:855,homeY:270,team:'away',r:17,keeper:true,cooldown:0},
      {x:660,y:270,homeX:660,homeY:270,team:'away',r:14,cooldown:0},
      {x:600,y:390,homeX:600,homeY:390,team:'away',r:14,cooldown:0},
    ];
    Object.assign(liveMatch, {
      phase:'playing', canvas, context:canvas.getContext('2d'), players, human,
      ball:{x:480,y:270,r:8,vx:0,vy:0,owner:null}, score:{home:0,away:0},
      events:[], elapsed:0, last:performance.now(), resetUntil:0
    });

    const down = e => {
      liveMatch?.keys.add(e.code);
      if (['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)) e.preventDefault();
      if (e.code === 'Space') footballShoot(liveMatch?.human);
    };
    const up = e => liveMatch?.keys.delete(e.code);
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    liveMatch.cleanup = () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
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
    const length = Math.hypot(dx,dy) || 1;
    const speed = k.has('ShiftLeft') || k.has('ShiftRight') ? 225 : 170;
    m.human.vx = dx/length*speed; m.human.vy = dy/length*speed;

    m.players.forEach(p => {
      p.cooldown = Math.max(0, p.cooldown - dt);
      if (!p.human) updateFootballAI(m, p);
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
    context.fillStyle='rgba(0,0,0,.28)';context.beginPath();context.ellipse(p.x+2,p.y+6,p.r+3,p.r*.6,0,0,Math.PI*2);context.fill();
    context.fillStyle=p.team==='home'?'#dfff53':'#4267d6';context.beginPath();context.arc(p.x,p.y,p.r,0,Math.PI*2);context.fill();context.strokeStyle=p.team==='home'?'#152016':'#c5d0ff';context.lineWidth=3;context.stroke();
    if(selected){context.strokeStyle='#fff';context.lineWidth=2;context.beginPath();context.arc(p.x,p.y,p.r+7,0,Math.PI*2);context.stroke();}
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
    const cfg = CONFIG[state.sport];
    const isBasketball = state.sport === 'basketball';
    // Basketball: harder to stay in NBA (need >40%), G-League promotion needs >60%
    const promotionThreshold = isBasketball ? 0.60 : 0.55;
    const relegationThreshold = isBasketball ? 0.38 : 0.30;

    if (winRate >= promotionThreshold && c.leagueIndex < cfg.leagues.length - 1) {
      c.leagueIndex++;
      c.promotions++;
      const teams = isBasketball ? cfg.teamsByLeague[c.leagueIndex] : cfg.teamNames;
      c.teamName = teams[rand(0, teams.length - 1)];
      if (isBasketball) {
        addLog(`NBA Comeback! Zurück in der NBA bei den ${c.teamName}! 🏀🔥`, 'special');
      } else {
        addLog(`Aufgestiegen! Jetzt in der ${leagueName(state)} 🎉`, 'special');
      }
    } else if (winRate < relegationThreshold && c.leagueIndex > 0) {
      c.leagueIndex--;
      c.relegations++;
      const teams = isBasketball ? cfg.teamsByLeague[c.leagueIndex] : cfg.teamNames;
      c.teamName = teams[rand(0, teams.length - 1)];
      if (isBasketball && c.leagueIndex === 0) {
        addLog(`Abgestiegen in die G-League (${c.teamName}). Kämpf dich zurück! 😤`, 'bad');
      } else {
        addLog(`Abgestiegen in die ${leagueName(state)} 😤`, 'bad');
      }
    } else {
      if (isBasketball && c.leagueIndex === 1) {
        addLog(`NBA-Saison ${c.season - 1} überstanden. Vertrag verlängert bei den ${c.teamName}. 💰`, 'neutral');
      } else if (isBasketball && c.leagueIndex === 0) {
        addLog(`G-League Saison abgeschlossen (${Math.round(winRate * 100)}% Siege). Noch nicht gut genug für NBA.`, 'neutral');
      } else {
        addLog(`Saison ${c.season - 1} abgeschlossen. Bleibst in der ${leagueName(state)}.`, 'neutral');
      }
    }

    // Reset season stats
    c.wins = 0; c.losses = 0; c.draws = 0;
    c.seasonLog = [];

    // Bonus money — NBA scale vs G-League scale
    const bonus = isBasketball
      ? (c.leagueIndex === 1 ? rand(1500000, 5000000) : rand(50000, 150000))
      : rand(2000, 8000) * (c.leagueIndex + 1);
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
            <p>NBA-Rookie — oder G-League Grind?</p>
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

  // ── NBA STATUS CARD ────────────────────────────────
  function renderNBAStatus() {
    const c = state.career;
    const isNBA = c.leagueIndex === 1;
    const total = c.wins + c.losses + c.draws;
    const winRate = total > 0 ? Math.round(c.wins / total * 100) : 0;
    const threshold = isNBA ? 38 : 60;
    const direction = isNBA ? 'Abstiegszone' : 'Aufstiegszone';
    const color = isNBA ? 'var(--danger)' : 'var(--gold)';
    const dangerZone = isNBA ? winRate < threshold : winRate >= threshold;

    return `
      <div class="card" style="border-color:${isNBA ? 'var(--basketball)' : 'var(--muted)'}">
        <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px">
          <div>
            <div style="font-size:1rem;font-weight:800">
              ${isNBA ? '🏀 NBA — ' + c.teamName : '😤 G-League — ' + c.teamName}
            </div>
            <div style="color:var(--muted);font-size:.82rem;margin-top:3px">
              ${isNBA
                ? `Bleib über ${threshold}% Siege um deinen Vertrag zu halten`
                : `Übertriff ${threshold}% Siege für einen NBA-Recall`}
            </div>
          </div>
          <div style="text-align:right">
            <div style="font-size:1.4rem;font-weight:900;color:${dangerZone ? color : 'var(--text)'}">${winRate}%</div>
            <div style="font-size:.75rem;color:var(--muted)">Win Rate</div>
          </div>
        </div>
        ${total > 0 ? `
        <div style="margin-top:10px">
          <div class="season-progress"><div class="season-fill" style="width:${winRate}%;background:${isNBA && winRate < threshold ? 'var(--danger)' : winRate >= threshold && !isNBA ? 'var(--gold)' : 'var(--accent)'}"></div></div>
          <div style="display:flex;justify-content:space-between;font-size:.72rem;color:var(--muted);margin-top:3px">
            <span>0%</span>
            <span style="color:${color}">▼ ${threshold}% ${direction}</span>
            <span>100%</span>
          </div>
        </div>` : ''}
      </div>
    `;
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
        ${state.sport === 'basketball' ? renderNBAStatus() : ''}
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
    startFootballMatch,
    abandonFootballMatch,
    train,
    doRest,
    useSkillPoint,
  };
})();

document.addEventListener('DOMContentLoaded', () => App.init());
