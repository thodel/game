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
        <div style="font-size:.75rem;color:var(--muted);margin-top:4px">${c.teamName} • ${p ? '' : ''}${total} Spiele</div>
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
    train,
    doRest,
    useSkillPoint,
  };
})();

document.addEventListener('DOMContentLoaded', () => App.init());
