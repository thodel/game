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
      matchEvents: {
        player: ['Tor! ⚽', 'Traumpass 🎯', 'Elfer verwandelt 💥', 'Flanke zum Tor 🎪', 'Freistoss ✨', 'Volley-Knaller 💥', 'Kopfball-Tor 🦅'],
        opponent: ['Gegentor 😤', 'Elfmeter kassiert ⚠️', 'Rote Karte! 🟥', 'Eigentor 😱', 'Spätausgleich 😮'],
        neutral: ['Gelbe Karte 🟨', 'Pfostentreffer 😬', 'Grosschance vergeben 😤', 'Verlängerung! ⏱️', 'VAR-Entscheid 📺', 'Elfmeterschiessen 💥'],
      },
      teamsByLeague: [
        // 0: Kreisliga
        ['FC Dorfkicker', 'SV Grüntal', 'TSV Bergheim', 'SpVgg Niederbach', 'FC Rot-Weiß Kleinstadt', 'SV Eintracht Tal', 'FV Waldrand', 'Sportfreunde Heide', 'VfB Musterburg', 'FC Sonnenberg', 'TSG Blautal', 'SV Schwarzwald', 'FC Feldkirch', 'VfL Steinbach'],
        // 1: Regionalliga
        ['SSV Ulm 1846', 'Jahn Regensburg', 'SV Elversberg', 'FC Ingolstadt 04', '1. FC Saarbrücken', 'Hallescher FC', 'Rot-Weiß Essen', 'Preußen Münster', 'MSV Duisburg', 'FC Erzgebirge Aue', 'Dynamo Dresden', 'SpVgg Unterhaching', 'TSV 1860 München', 'VfB Lübeck', 'Kickers Offenbach', 'SV Wehen Wiesbaden'],
        // 2: 2. Bundesliga
        ['Hamburger SV', '1. FC Köln', 'FC Schalke 04', 'Hertha BSC', '1. FC Kaiserslautern', 'Hannover 96', 'Fortuna Düsseldorf', 'Karlsruher SC', 'SpVgg Greuther Fürth', '1. FC Nürnberg', 'Eintracht Braunschweig', '1. FC Magdeburg', 'SC Paderborn', 'SV Darmstadt 98', 'Holstein Kiel', 'FC St. Pauli'],
        // 3: Ligue 2
        ['Paris FC', 'FC Metz', 'Grenoble Foot 38', 'SM Caen', 'AS Saint-Étienne', 'Amiens SC', 'Valenciennes FC', 'Rodez AF', 'US Quevilly-Rouen', 'Annecy FC', 'En Avant Guingamp', 'Stade Lavallois', 'US Concarneau', 'Pau FC', 'AJ Auxerre', 'ESTAC Troyes'],
        // 4: 1. Bundesliga
        ['FC Bayern München', 'Borussia Dortmund', 'RB Leipzig', 'Bayer 04 Leverkusen', 'Eintracht Frankfurt', 'VfB Stuttgart', 'VfL Wolfsburg', 'TSG 1899 Hoffenheim', 'SC Freiburg', '1. FSV Mainz 05', 'FC Augsburg', 'VfL Bochum', 'Borussia Mönchengladbach', '1. FC Union Berlin', '1. FC Heidenheim', 'Werder Bremen'],
        // 5: La Liga
        ['Real Madrid CF', 'FC Barcelona', 'Atlético de Madrid', 'Athletic Club Bilbao', 'Real Sociedad', 'Villarreal CF', 'Valencia CF', 'Sevilla FC', 'Real Betis', 'RC Celta Vigo', 'Girona FC', 'CA Osasuna', 'Rayo Vallecano', 'Getafe CF', 'RCD Mallorca', 'UD Las Palmas', 'RCD Espanyol', 'Deportivo Alavés'],
        // 6: Ligue 1
        ['Paris Saint-Germain', 'Olympique de Marseille', 'Olympique Lyonnais', 'AS Monaco', 'LOSC Lille', 'Stade Rennais FC', 'RC Lens', 'OGC Nice', 'Toulouse FC', 'Stade de Reims', 'Montpellier HSC', 'RC Strasbourg', 'FC Nantes', 'Angers SCO', 'Le Havre AC', 'Stade Brestois 29'],
        // 7: Premier League
        ['Manchester City', 'Arsenal FC', 'Liverpool FC', 'Chelsea FC', 'Manchester United', 'Tottenham Hotspur', 'Newcastle United', 'Aston Villa', 'Brighton & Hove Albion', 'West Ham United', 'Brentford FC', 'Crystal Palace', 'Fulham FC', 'Wolverhampton Wanderers', 'Everton FC', 'Nottingham Forest', 'AFC Bournemouth', 'Leicester City', 'Southampton FC', 'Ipswich Town'],
        // 8: Conference League
        ['ACF Fiorentina', 'Olympiakos FC', 'Real Betis', 'AZ Alkmaar', 'SC Braga', 'KAA Gent', 'PAOK FC', 'SK Rapid Wien', 'FC Basel', 'Djurgårdens IF', 'Molde FK', 'Go Ahead Eagles', 'FC København', 'FC Lugano', 'HJK Helsinki', 'FC Viktoria Plzeň'],
        // 9: Europa League
        ['AS Roma', 'SS Lazio', 'Atlético de Madrid', 'Atalanta BC', 'Eintracht Frankfurt', 'Bayer 04 Leverkusen', 'AFC Ajax', 'PSV Eindhoven', 'FC Porto', 'SL Benfica', 'Galatasaray SK', 'Fenerbahçe SK', 'Olympique Lyonnais', 'Sevilla FC', 'SK Slavia Praha', 'Rangers FC'],
        // 10: Champions League
        ['Real Madrid CF', 'FC Barcelona', 'Manchester City', 'Liverpool FC', 'FC Bayern München', 'Paris Saint-Germain', 'Juventus FC', 'FC Internazionale', 'AC Milan', 'Chelsea FC', 'Arsenal FC', 'Atlético de Madrid', 'Borussia Dortmund', 'RB Leipzig', 'SL Benfica', 'AFC Ajax', 'FC Porto', 'Celtic FC', 'Shakhtar Donetsk', 'Club Brugge', 'SSC Napoli', 'Feyenoord', 'FC Red Bull Salzburg', 'BSC Young Boys'],
      ],
      leagues: ['Kreisliga', 'Regionalliga', '2. Bundesliga', 'Ligue 2', '1. Bundesliga', 'La Liga', 'Ligue 1', 'Premier League', 'Conference League', 'Europa League', 'Champions League'],
      leagueFlags: ['🇩🇪','🇩🇪','🇩🇪','🇫🇷','🇩🇪','🇪🇸','🇫🇷','🇬🇧','🇪🇺','🇪🇺','🇪🇺'],
      europeanCupStart: 8,
      get teamNames() { return this.teamsByLeague[4]; },
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

  // ── #18 Position weights ──────────────────────────
  const POSITION_WEIGHTS = {
    football: {
      'Torwart':   { Tempo:0.5, Technik:0.8, Schuss:0.2, Dribbling:0.3, Kondition:1.0, Kopfball:1.2 },
      'Abwehr':    { Tempo:0.9, Technik:0.7, Schuss:0.3, Dribbling:0.5, Kondition:1.1, Kopfball:1.3 },
      'Mittelfeld':{ Tempo:1.0, Technik:1.3, Schuss:0.8, Dribbling:1.1, Kondition:1.2, Kopfball:0.8 },
      'Stürmer':   { Tempo:1.2, Technik:1.0, Schuss:1.5, Dribbling:1.2, Kondition:0.9, Kopfball:1.1 },
    },
    basketball: {
      'Point Guard':    { Speed:1.3, Ballhandling:1.5, '3-Pointer':1.0, Defense:0.7, Dunks:0.5, IQ:1.4 },
      'Shooting Guard': { Speed:1.1, Ballhandling:1.0, '3-Pointer':1.5, Defense:0.8, Dunks:0.8, IQ:1.0 },
      'Small Forward':  { Speed:1.0, Ballhandling:0.9, '3-Pointer':1.1, Defense:1.0, Dunks:1.1, IQ:1.0 },
      'Power Forward':  { Speed:0.7, Ballhandling:0.7, '3-Pointer':0.6, Defense:1.3, Dunks:1.4, IQ:1.0 },
      'Center':         { Speed:0.5, Ballhandling:0.5, '3-Pointer':0.3, Defense:1.5, Dunks:1.5, IQ:1.1 },
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
  const SAVE_PREFIX = 'sportsCareer_v1_';
  function saveKey(s) { return SAVE_PREFIX + (s?.player?.name || 'unnamed').replace(/\s+/g, '_'); }
  function saveGame() {
    if (!state || state._quickGame) return;
    localStorage.setItem(saveKey(state), JSON.stringify(state));
  }
  function loadGame(name) {
    try {
      const key = name ? SAVE_PREFIX + name.replace(/\s+/g, '_') : null;
      if (key) { const d = localStorage.getItem(key); return d ? JSON.parse(d) : null; }
      // Legacy: return first found save
      return allSaves()[0] || null;
    } catch { return null; }
  }
  function allSaves() {
    const saves = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k.startsWith(SAVE_PREFIX)) continue;
      try { const d = JSON.parse(localStorage.getItem(k)); if (d?.player?.name) saves.push(d); } catch {}
    }
    return saves.sort((a, b) => (b.career?.season || 0) - (a.career?.season || 0));
  }
  function clearSave(name) {
    const key = name ? SAVE_PREFIX + name.replace(/\s+/g, '_') : saveKey(state);
    localStorage.removeItem(key);
  }

  // ── Utils ──────────────────────────────────────────
  function rand(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
  function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
  function fmt(n) { return n.toLocaleString('de-CH'); }
  function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }

  // ── Epic #3 helpers ───────────────────────────
  function generateContract(sport, leagueIndex) {
    const isBasketball = sport === 'basketball';
    let wage;
    if (isBasketball) { wage = leagueIndex === 1 ? rand(50000, 300000) : rand(1000, 5000); }
    else { wage = rand(200, 2000) * (leagueIndex + 1); }
    return { wage, lengthSeasons: rand(1, 3), expiresAfterSeason: rand(2, 5), bonusPerGoal: isBasketball ? rand(500, 2000) : rand(50, 200) };
  }

  function initLeagueTable(sport, myTeamName, leagueIndex) {
    if (sport !== 'football') return [];
    const pool = (CONFIG.football.teamsByLeague[leagueIndex] || CONFIG.football.teamsByLeague[4])
      .filter(n => n !== myTeamName);
    const rivals = shuffle(pool).slice(0, 9); // 9 rivals + player = 10-team league
    const leagueStr = 35 + leagueIndex * 5; // stronger teams in higher leagues
    const table = rivals.map(name => ({ name, strength: rand(leagueStr - 10, leagueStr + 20), w:0, d:0, l:0, pts:0, gf:0, ga:0 }));
    table.push({ name: myTeamName, strength: 40 + leagueIndex * 4, w:0, d:0, l:0, pts:0, gf:0, ga:0, isPlayer: true });
    return table;
  }

  function generateFixtures(leagueTable, myTeamName) {
    if (!leagueTable || leagueTable.length === 0) return [];
    const rivals = leagueTable.filter(t => t.name !== myTeamName);
    const leagueWeekPool = [1,2,3,4,5,6,7,9,10,11,12,13,14,15,17,18,19,20,21,22];
    const selected = shuffle(leagueWeekPool).slice(0, 14).sort((a,b) => a-b);
    const fixtures = [];
    rivals.forEach((rival, i) => {
      fixtures.push({ week: selected[i], opponent: rival.name, home: true, type: 'league', played: false });
      fixtures.push({ week: selected[i + 7], opponent: rival.name, home: false, type: 'league', played: false });
    });
    fixtures.push({ week: 8,  opponent: 'Pokal-Gegner', home: rand(0,1)===1, type: 'cup', played: false });
    fixtures.push({ week: 16, opponent: 'Pokal-Gegner', home: rand(0,1)===1, type: 'cup', played: false });
    return fixtures.sort((a,b) => a.week - b.week);
  }

  function simulateRivalFixtures(leagueTable) {
    if (!leagueTable || leagueTable.length < 2) return;
    const rivals = leagueTable.filter(t => !t.isPlayer);
    if (rivals.length < 2) return;
    const n = rand(3, 4);
    for (let i = 0; i < n; i++) {
      const idx1 = rand(0, rivals.length - 1);
      let idx2 = rand(0, rivals.length - 2); if (idx2 >= idx1) idx2++;
      const home = rivals[idx1], away = rivals[idx2];
      const hScore = home.strength + rand(0, 30), aScore = away.strength + rand(0, 30);
      if (hScore > aScore) {
        const hg = rand(1,3), ag = rand(0,2);
        home.w++; home.pts+=3; home.gf+=hg; home.ga+=ag;
        away.l++; away.gf+=ag; away.ga+=hg;
      } else if (hScore < aScore) {
        const ag = rand(1,3), hg = rand(0,2);
        away.w++; away.pts+=3; away.gf+=ag; away.ga+=hg;
        home.l++; home.gf+=hg; home.ga+=ag;
      } else {
        const g = rand(0,2);
        home.d++; home.pts++; home.gf+=g; home.ga+=g;
        away.d++; away.pts++; away.gf+=g; away.ga+=g;
      }
    }
  }

  function advanceWeek() {
    const c = state.career, p = state.player;
    if (state.contract) { p.money += state.contract.wage; p.totalEarned += state.contract.wage; }
    if (p.injury) {
      p.injury.weeksLeft--;
      if (p.injury.weeksLeft <= 0) { p.injury = null; addLog('Verletzung auskuriert! Bereit für den Einsatz. 🏃', 'good'); }
    }
    if ((p.suspension || 0) > 0) p.suspension--;
    c.week++;
    if (c.week > c.weeksPerSeason) endSeason();
  }

  function newState(sport, playerName, position) {
    const cfg = CONFIG[sport];
    const isBasketball = sport === 'basketball';
    const baseStats = {};
    cfg.stats.forEach(s => { baseStats[s] = isBasketball ? rand(45, 65) : rand(20, 40); });
    const startLeague = cfg.startLeagueIndex ?? 0;
    const startTeams = isBasketball ? cfg.teamsByLeague[startLeague] : (cfg.teamsByLeague?.[startLeague] || cfg.teamNames);
    const teamName = startTeams[rand(0, startTeams.length - 1)];
    const leagueTable = initLeagueTable(sport, teamName, startLeague);
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
        injury: null,
        suspension: 0,
        yellowCards: 0,
      },
      career: {
        leagueIndex: startLeague,
        teamName,
        season: 1, seasons: 0, week: 1,
        weeksPerSeason: isBasketball ? (startLeague === 1 ? 38 : 24) : 24,
        regularSeasonWeeks: isBasketball ? (startLeague === 1 ? 30 : 20) : 24,
        wins: 0, losses: 0, draws: 0,
        goals: 0, assists: 0, promotions: 0, relegations: 0, bestMatchGoals: 0,
        bbStandings: isBasketball ? initBBStandings(startLeague, teamName) : null,
        playoffs: null,
      },
      achievements: [], log: [], seasonLog: [],
      contract: generateContract(sport, startLeague),
      leagueTable,
      fixtures: generateFixtures(leagueTable, teamName),
    };
  }

  // ── Basketball standings helpers ──────────────────
  function initBBStandings(leagueIdx, playerTeam) {
    const cfg = CONFIG.basketball;
    const pool = cfg.teamsByLeague[leagueIdx].filter(n => n !== playerTeam);
    const rivals = shuffle(pool).slice(0, 14); // 14 rivals + player = 15 teams
    const rows = rivals.map(name => ({
      name, strength: rand(40, 85), w: 0, l: 0, pct: 0
    }));
    // Give rivals a plausible start (spread of existing records)
    rows.forEach(r => {
      const g = rand(0, 5);
      r.w = rand(0, g); r.l = g - r.w;
      r.pct = r.w + r.l > 0 ? r.w / (r.w + r.l) : 0;
    });
    return { rows, playoffSeeds: [] };
  }

  function simBBRivalWeek() {
    if (!state.career.bbStandings) return;
    const rows = state.career.bbStandings.rows;
    // Simulate 1–2 rival games per week
    const games = rand(1, 2);
    for (let g = 0; g < games; g++) {
      const i = rand(0, rows.length - 1);
      let j = rand(0, rows.length - 1);
      while (j === i) j = rand(0, rows.length - 1);
      const a = rows[i], b = rows[j];
      const pa = a.strength + rand(-10, 10), pb = b.strength + rand(-10, 10);
      if (pa >= pb) { a.w++; b.l++; } else { b.w++; a.l++; }
      a.pct = a.w / (a.w + a.l);
      b.pct = b.w / (b.w + b.l);
    }
  }

  function getBBTableRows() {
    if (!state.career.bbStandings) return [];
    const c = state.career;
    const playerRow = {
      name: c.teamName, strength: 70,
      w: c.wins, l: c.losses,
      pct: c.wins + c.losses > 0 ? c.wins / (c.wins + c.losses) : 0,
      isPlayer: true
    };
    const all = [playerRow, ...state.career.bbStandings.rows];
    return all.sort((a, b) => b.pct - a.pct || b.w - a.w);
  }

  function isInPlayoffs() {
    const rows = getBBTableRows();
    const pos = rows.findIndex(r => r.isPlayer);
    return pos >= 0 && pos < 8;
  }

  // ── Basketball playoff helpers ───────────────────
  function initPlayoffs() {
    const rows = getBBTableRows();
    const seeds = rows.slice(0, 8);
    const playerSeed = seeds.findIndex(r => r.isPlayer);
    // Bracket: 1v8, 2v7, 3v6, 4v5
    const pairs = [[0,7],[1,6],[2,5],[3,4]];
    return {
      round: 1, // 1=Conf QF, 2=Conf SF, 3=Conf Final, 4=Finals
      seeds: seeds.map(r => r.name),
      bracket: pairs.map(([a, b]) => ({
        teamA: seeds[a].name,
        teamB: seeds[b].name,
        winsA: 0, winsB: 0, done: false, winner: null
      })),
      playerSeed,
      champion: null,
    };
  }

  function simPlayoffGame() {
    // Simulate one playoff week = one game in player's series
    const c = state.career;
    if (!c.playoffs) return null;
    const pl = c.playoffs;
    const playerIdx = pl.bracket.findIndex(
      s => s.teamA === c.teamName || s.teamB === c.teamName
    );
    if (playerIdx === -1) {
      // Player already eliminated — sim other series and advance
      advancePlayoffRound();
      return { eliminated: true };
    }
    const series = pl.bracket[playerIdx];
    const isTeamA = series.teamA === c.teamName;
    const playerStrength = avgStat(state.player);
    const oppStrength = rand(50, 90);
    const win = (playerStrength + rand(-15, 15)) > (oppStrength + rand(-15, 15));
    if (win) { if (isTeamA) series.winsA++; else series.winsB++; c.wins++; }
    else     { if (isTeamA) series.winsB++; else series.winsA++; c.losses++; }
    const myWins = isTeamA ? series.winsA : series.winsB;
    const oppWins = isTeamA ? series.winsB : series.winsA;
    const oppName = isTeamA ? series.teamB : series.teamA;
    if (myWins === 4 || oppWins === 4) {
      series.done = true;
      series.winner = myWins === 4 ? c.teamName : oppName;
      if (oppWins === 4) {
        // Player eliminated
        const roundNames = ['', '1. Runde', 'Conference Semifinal', 'Conference Final', 'NBA Finals'];
        addLog(`Playoffs beendet — Ausgeschieden in Runde ${pl.round} (${roundNames[pl.round]}) gegen ${oppName} ${myWins}:4 😤`, 'bad');
        return { eliminated: true, round: pl.round, oppName };
      } else {
        // Series won
        advancePlayoffRound();
        if (pl.round > 4) {
          // Champion!
          pl.champion = c.teamName;
          addLog(`🏆 NBA CHAMPION! Die ${c.teamName} sind Meister!`, 'special');
          return { champion: true };
        }
        return { seriesWin: true, myWins, round: pl.round };
      }
    }
    return { win, myWins, oppWins, oppName };
  }

  function advancePlayoffRound() {
    const pl = state.career.playoffs;
    // Sim remaining series
    pl.bracket.forEach(s => {
      if (!s.done) {
        while (s.winsA < 4 && s.winsB < 4) {
          const pa = rand(40, 90), pb = rand(40, 90);
          if (pa > pb) s.winsA++; else s.winsB++;
        }
        s.done = true;
        s.winner = s.winsA === 4 ? s.teamA : s.teamB;
      }
    });
    pl.round++;
    if (pl.round > 4) return;
    // Build next round bracket
    const winners = pl.bracket.map(s => s.winner);
    pl.bracket = [
      { teamA: winners[0], teamB: winners[1], winsA: 0, winsB: 0, done: false, winner: null },
      { teamA: winners[2], teamB: winners[3], winsA: 0, winsB: 0, done: false, winner: null },
    ];
    if (pl.round === 4) {
      // Finals: consolidate to 1 matchup
      pl.bracket = [{ teamA: winners[0], teamB: winners[2], winsA: 0, winsB: 0, done: false, winner: null }];
    }
  }

  // ── Computed helpers ───────────────────────────────
  function avgStat(player) {
    const vals = Object.values(player.stats);
    return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
  }

  // #18 — position-weighted rating
  function positionRating(player) {
    const weights = (POSITION_WEIGHTS[state.sport] || {})[player.position];
    if (!weights) return avgStat(player);
    let total = 0, wSum = 0;
    for (const [stat, val] of Object.entries(player.stats)) {
      const w = weights[stat] ?? 1.0;
      total += val * w; wSum += w;
    }
    return Math.round(total / wSum);
  }

  function leagueName(s) {
    const cfg = CONFIG[s.sport];
    const name = cfg.leagues[s.career.leagueIndex] || 'Unbekannt';
    const flag = cfg.leagueFlags?.[s.career.leagueIndex] || '';
    return flag ? flag + ' ' + name : name;
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
    const skill = positionRating(p);
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

    // Simulate rival games for BB standings
    if (state.sport === 'basketball') simBBRivalWeek();

    // #17 Injury check (basketball; football uses finishFootballMatch)
    let injuryMsg = null;
    if (state.sport !== 'football') {
      const injuryChance = p.energy < 30 ? 0.15 : 0.08;
      if (!p.injury && Math.random() < injuryChance) {
        const sev = Math.random();
        if (sev < 0.6) {
          const wl = rand(1,2); injuryMsg = `Muskelverletzung \u2014 ${wl} Wochen Pause`;
          p.injury = { weeksLeft: wl, type: 'minor' };
        } else if (sev < 0.9) {
          const wl = rand(3,5); injuryMsg = `B\u00e4nderriss \u2014 ${wl} Wochen Pause`;
          p.injury = { weeksLeft: wl, type: 'moderate' };
        } else {
          const wl = rand(6,10); injuryMsg = `Knochenbruch \u2014 ${wl} Wochen Pause`;
          const physStats = ['Speed','Dunks'];
          const dmgStat = physStats[rand(0, physStats.length-1)];
          p.stats[dmgStat] = clamp(p.stats[dmgStat] - 2, 1, 99);
          p.injury = { weeksLeft: wl, type: 'severe' };
        }
        addLog(`\u26a0\ufe0f ${injuryMsg}`, 'bad');
      }
    }

    advanceWeek();

    return {
      playerGoals, oppGoals, result, opponent,
      events, money, personal, assists, injuryMsg,
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
    const preview = [...createFootballLineup('home',false),...createFootballLineup('away',false)];
    preview.sort((a,b)=>a.y-b.y).forEach(p => drawFootballer(context,p,p.team==='home'&&p.number===10));
    drawFootball(context, {x:480,y:270,r:8});
  }

  function createFootballLineup(team,selectHuman=true) {
    const formation=[
      {x:105,y:270,number:1,role:'GK',keeper:true},
      {x:225,y:100,number:2,role:'RB'},{x:225,y:210,number:4,role:'CB'},
      {x:225,y:330,number:5,role:'CB'},{x:225,y:440,number:3,role:'LB'},
      {x:410,y:150,number:8,role:'CM'},{x:410,y:270,number:10,role:'CAM'},
      {x:410,y:390,number:6,role:'CM'},
      {x:575,y:125,number:7,role:'RW'},{x:600,y:270,number:9,role:'ST'},
      {x:575,y:415,number:11,role:'LW'}
    ];
    return formation.map(def=>{
      const x=team==='home'?def.x:960-def.x;
      return { ...def,x,y:def.y,homeX:x,homeY:def.y,team,r:def.keeper?17:13,vx:0,vy:0,
        human:selectHuman&&team==='home'&&def.number===10,cooldown:0,
        facing:team==='home'?0:Math.PI,stride:0 };
    });
  }

  function startFootballMatch() {
    if (!liveMatch || liveMatch.phase !== 'ready') return;
    const canvas = document.getElementById('football-canvas');
    const kickoff = document.getElementById('live-kickoff');
    if (!canvas) return;
    kickoff?.remove();

    const players=[...createFootballLineup('home'),...createFootballLineup('away')];
    const human=players.find(p=>p.human);
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
    // Show exit options instead of immediately abandoning
    const modal = document.createElement('div');
    modal.className = 'modal-bg';
    modal.innerHTML = `
      <div class="modal">
        <h3>⏸️ Spiel verlassen?</h3>
        <p>Was möchtest du tun?</p>
        <div class="modal-btns" style="flex-direction:column;gap:10px">
          <button class="btn btn-danger" onclick="App._exitMatchSave()">
            💾 Speichern &amp; beenden
            <div style="font-size:.75rem;font-weight:400;margin-top:3px">Niederlage wird gewertet</div>
          </button>
          <button class="btn btn-ghost" onclick="App._exitMatchNoSave()">
            🗑️ Beenden ohne speichern
            <div style="font-size:.75rem;font-weight:400;margin-top:3px">Match wird rückgängig gemacht</div>
          </button>
          <button class="btn btn-ghost btn-sm" onclick="this.closest('.modal-bg').remove()">← Weiterspielen</button>
        </div>
      </div>`;
    document.body.appendChild(modal);
  }

  function _exitMatchSave() {
    // Count as a loss, save, go to hub
    document.querySelector('.modal-bg')?.remove();
    if (liveMatch?.raf) cancelAnimationFrame(liveMatch.raf);
    liveMatch?.cleanup?.();
    const c = state.career, p = state.player;
    c.losses++;
    c.week++;
    if (c.week > c.weeksPerSeason) endSeason();
    p.energy = clamp(p.energy - rand(10, 20), 0, 100);
    p.morale = clamp(p.morale - rand(3, 8), 0, 100);
    addLog(`Spiel abgebrochen — als Niederlage gewertet`, 'bad');
    liveMatch = null;
    saveGame();
    showHub('home');
  }

  function _exitMatchNoSave() {
    // Discard everything — restore from last save
    document.querySelector('.modal-bg')?.remove();
    if (liveMatch?.raf) cancelAnimationFrame(liveMatch.raf);
    liveMatch?.cleanup?.();
    liveMatch = null;
    const saved = loadGame();
    if (saved) {
      state = saved;
      addLog('Spiel verlassen — kein Fortschritt gespeichert', 'neutral');
    }
    showHub('home');
  }

  function footballDistance(a,b){return Math.hypot(a.x-b.x,a.y-b.y);}

  function drawFootballMatch(m) {
    drawFootballPitch(m.context,960,540);
    m.players.slice().sort((a,b)=>a.y-b.y).forEach(p=>drawFootballer(m.context,p,p.human));
    drawFootball(m.context,m.ball);
  }

  function drawFootballPitch(context,w,h) {
    const sky=context.createLinearGradient(0,0,0,160);sky.addColorStop(0,'#07131b');sky.addColorStop(1,'#26383e');context.fillStyle=sky;context.fillRect(0,0,w,h);
    context.fillStyle='#202a2f';context.fillRect(0,42,w,92);
    const crowd=['#eef1ef','#dfff53','#ef5c53','#4d78e0'];
    for(let row=0;row<4;row++)for(let col=0;col<80;col++){context.fillStyle=crowd[(row*5+col*3)%crowd.length];context.globalAlpha=.52;context.beginPath();context.arc(col*12+(row%2)*5,61+row*17,2.1,0,Math.PI*2);context.fill();}
    context.globalAlpha=1;context.fillStyle='#0f171a';context.fillRect(0,128,w,18);
    const corners=[[48,34],[912,34],[912,506],[48,506]].map(([x,y])=>projectFootball3D(x,y));
    const grass=context.createLinearGradient(0,corners[0].y,0,corners[2].y);grass.addColorStop(0,'#2e7d3b');grass.addColorStop(1,'#16552d');context.fillStyle=grass;fillProjectedShape(context,corners);
    for(let i=0;i<10;i++){const x1=48+i*86.4,x2=x1+86.4;context.fillStyle=i%2?'rgba(255,255,255,.025)':'rgba(0,0,0,.06)';fillProjectedShape(context,[[x1,34],[x2,34],[x2,506],[x1,506]].map(([x,y])=>projectFootball3D(x,y)));}
    context.strokeStyle='rgba(255,255,255,.78)';context.lineWidth=2;
    strokeWorldLine(context,[[48,34],[912,34],[912,506],[48,506],[48,34]]);
    strokeWorldLine(context,[[480,34],[480,506]]);
    strokeWorldEllipse(context,480,270,62,62);
    strokeWorldLine(context,[[48,160],[168,160],[168,380],[48,380]]);
    strokeWorldLine(context,[[912,160],[792,160],[792,380],[912,380]]);
    strokeWorldLine(context,[[48,205],[93,205],[93,335],[48,335]]);
    strokeWorldLine(context,[[912,205],[867,205],[867,335],[912,335]]);
    drawGoal3D(context,'home');drawGoal3D(context,'away');
  }

  function projectFootball3D(x,y,z=0) {
    const depth=clamp((y-34)/472,0,1),scale=.7+depth*.35;
    return {x:480+(x-480)*scale,y:108+depth*394-z*scale,scale,depth};
  }

  function fillProjectedShape(context,points){context.beginPath();points.forEach((p,i)=>i?context.lineTo(p.x,p.y):context.moveTo(p.x,p.y));context.closePath();context.fill();}
  function strokeWorldLine(context,points){context.beginPath();points.forEach(([x,y],i)=>{const p=projectFootball3D(x,y);i?context.lineTo(p.x,p.y):context.moveTo(p.x,p.y);});context.stroke();}
  function strokeWorldEllipse(context,cx,cy,rx,ry){const points=[];for(let i=0;i<=40;i++){const a=i/40*Math.PI*2;points.push([cx+Math.cos(a)*rx,cy+Math.sin(a)*ry]);}strokeWorldLine(context,points);}

  function drawGoal3D(context,team){
    const x=team==='home'?48:912,backX=team==='home'?20:940,top=205,bottom=335,height=30;
    const a=projectFootball3D(x,top),b=projectFootball3D(x,bottom),at=projectFootball3D(x,top,height),bt=projectFootball3D(x,bottom,height),c=projectFootball3D(backX,top,height),d=projectFootball3D(backX,bottom,height);
    context.strokeStyle='rgba(242,246,244,.88)';context.lineWidth=3;context.beginPath();context.moveTo(a.x,a.y);context.lineTo(at.x,at.y);context.lineTo(bt.x,bt.y);context.lineTo(b.x,b.y);context.moveTo(at.x,at.y);context.lineTo(c.x,c.y);context.lineTo(d.x,d.y);context.lineTo(bt.x,bt.y);context.stroke();
    context.strokeStyle='rgba(220,230,225,.24)';context.lineWidth=1;for(let i=1;i<5;i++){const y=top+(bottom-top)*i/5,front=projectFootball3D(x,y,height),back=projectFootball3D(backX,y,height);context.beginPath();context.moveTo(front.x,front.y);context.lineTo(back.x,back.y);context.stroke();}
  }

  function drawFootballer(context,p,selected) {
    const projected=projectFootball3D(p.x,p.y),scale=projected.scale*(p.keeper?1.04:1);
    const moving=Math.hypot(p.vx||0,p.vy||0)>8;
    const step=moving?Math.sin(p.stride||0)*3.5:0;
    const kit=p.keeper?'#f2a900':p.team==='home'?'#dfff53':'#4267d6';
    const trim=p.keeper?'#211b0c':p.team==='home'?'#142016':'#d5ddff';
    const skin=p.team==='home'?'#d7a071':'#9a6548';
    context.save();context.translate(projected.x,projected.y);context.scale(scale,scale);
    context.fillStyle='rgba(0,0,0,.32)';context.beginPath();context.ellipse(0,2,12,4.5,0,0,Math.PI*2);context.fill();
    context.strokeStyle=trim;context.lineWidth=4;context.lineCap='round';context.beginPath();context.moveTo(-4,-5);context.lineTo(-6+step*.35,4);context.moveTo(4,-5);context.lineTo(6-step*.35,4);context.stroke();
    context.strokeStyle=skin;context.lineWidth=3.2;context.beginPath();context.moveTo(-8,-24);context.lineTo(-13,-11-step*.25);context.moveTo(8,-24);context.lineTo(13,-11+step*.25);context.stroke();
    context.fillStyle=kit;context.strokeStyle=trim;context.lineWidth=1.5;context.beginPath();context.roundRect(-9,-32,18,27,5);context.fill();context.stroke();
    context.fillStyle=trim;context.font='800 7px system-ui';context.textAlign='center';context.textBaseline='middle';context.fillText(String(p.number||7),0,-19);
    context.fillStyle=skin;context.strokeStyle='rgba(44,26,17,.7)';context.lineWidth=1;context.beginPath();context.arc(0,-39,6.3,0,Math.PI*2);context.fill();context.stroke();
    context.fillStyle='#332319';context.beginPath();context.arc(0,-41,5.5,Math.PI,Math.PI*2);context.fill();
    context.restore();
    if(selected){context.strokeStyle='#fff';context.lineWidth=2;context.beginPath();context.ellipse(projected.x,projected.y,17*scale,7*scale,0,0,Math.PI*2);context.stroke();context.fillStyle='#fff';context.beginPath();context.moveTo(projected.x-5,projected.y-51*scale);context.lineTo(projected.x+5,projected.y-51*scale);context.lineTo(projected.x,projected.y-44*scale);context.fill();}
  }

  function drawFootball(context,b) {
    const speed=Math.hypot(b.vx||0,b.vy||0),height=b.owner?4:Math.min(12,speed*.022),ground=projectFootball3D(b.x,b.y),p=projectFootball3D(b.x,b.y,height),size=6.5*p.scale;
    context.fillStyle='rgba(0,0,0,.3)';context.beginPath();context.ellipse(ground.x,ground.y,7*ground.scale,3*ground.scale,0,0,Math.PI*2);context.fill();context.fillStyle='#fff';context.beginPath();context.arc(p.x,p.y,size,0,Math.PI*2);context.fill();context.strokeStyle='#c8cec9';context.lineWidth=1;context.stroke();context.fillStyle='#111';context.beginPath();context.arc(p.x,p.y,size*.3,0,Math.PI*2);context.fill();
  }

  function endSeason() {
    const c = state.career;
    const p = state.player;
    const isBasketball = state.sport === 'basketball';
    const cfg = CONFIG[state.sport];

    // Basketball: trigger playoffs at regularSeasonWeeks, not season end
    if (isBasketball && c.week > (c.regularSeasonWeeks || 20) && !c.playoffs) {
      if (isInPlayoffs()) {
        c.playoffs = initPlayoffs();
        const pos = getBBTableRows().findIndex(r => r.isPlayer) + 1;
        addLog(`🏆 Playoffs erreicht! Seed #${pos} — Runde 1 beginnt!`, 'special');
        return; // Don't end season yet — playoffs continue
      } else {
        addLog(`❌ Playoffs verpasst. Saison endet ohne Post-Season.`, 'bad');
        // fall through to season end
      }
    }

    c.week = 1;
    c.season++;
    c.seasons++;
    p.age++;
    p.skillPoints += 2;
    p.energy = 100;
    p.morale = clamp(p.morale + 10, 0, 100);
    c.playoffs = null;

    // Reset BB standings for new season
    if (isBasketball) {
      const teams = cfg.teamsByLeague[c.leagueIndex];
      c.bbStandings = initBBStandings(c.leagueIndex, c.teamName);
      c.weeksPerSeason = c.leagueIndex === 1 ? 38 : 24;
      c.regularSeasonWeeks = c.leagueIndex === 1 ? 30 : 20;
    }

    // Promotion / Relegation
    const winRate = c.wins / Math.max(c.wins + c.losses + c.draws, 1);
    const promotionThreshold = isBasketball ? 0.60 : 0.55;
    const relegationThreshold = isBasketball ? 0.38 : 0.30;

    if (winRate >= promotionThreshold && c.leagueIndex < cfg.leagues.length - 1) {
      c.leagueIndex++;
      c.promotions++;
      const teams = isBasketball
        ? cfg.teamsByLeague[c.leagueIndex]
        : (cfg.teamsByLeague?.[c.leagueIndex] || cfg.teamNames);
      c.teamName = teams[rand(0, teams.length - 1)];
      if (isBasketball) {
        addLog(`NBA Comeback! Zurück in der NBA bei den ${c.teamName}! 🏀🔥`, 'special');
      } else {
        const flag = cfg.leagueFlags?.[c.leagueIndex] || '';
        addLog(`${flag} Aufgestiegen in die ${leagueName(state)}! Neuer Klub: ${c.teamName} 🎉`, 'special');
      }
    } else if (winRate < relegationThreshold && c.leagueIndex > 0) {
      c.leagueIndex--;
      c.relegations++;
      const teams = isBasketball
        ? cfg.teamsByLeague[c.leagueIndex]
        : (cfg.teamsByLeague?.[c.leagueIndex] || cfg.teamNames);
      c.teamName = teams[rand(0, teams.length - 1)];
      if (isBasketball && c.leagueIndex === 0) {
        addLog(`Abgestiegen in die G-League (${c.teamName}). Kämpf dich zurück! 😤`, 'bad');
      } else {
        const flag = cfg.leagueFlags?.[c.leagueIndex] || '';
        addLog(`${flag} Abgestiegen in die ${leagueName(state)} (${c.teamName}) 😤`, 'bad');
      }
    } else {
      if (isBasketball && c.leagueIndex === 1) {
        addLog(`NBA-Saison ${c.season - 1} überstanden. Vertrag verlängert bei den ${c.teamName}. 💰`, 'neutral');
      } else if (isBasketball && c.leagueIndex === 0) {
        addLog(`G-League Saison abgeschlossen (${Math.round(winRate * 100)}% Siege). Noch nicht gut genug für NBA.`, 'neutral');
      } else if (!isBasketball) {
        // Football: check European cup qualification (leagues 4-7 = top national leagues)
        const ecStart = cfg.europeanCupStart ?? 8;
        if (c.leagueIndex >= 4 && c.leagueIndex < ecStart) {
          if (winRate >= 0.60) {
            addLog(`🏆 Champions League qualifiziert! Nächste Saison in der Champions League!`, 'special');
            // Store pending euro cup — will activate next season as parallel
            c.pendingEuroCup = 'cl';
          } else if (winRate >= 0.50) {
            addLog(`🇪🇺 Europa League qualifiziert für nächste Saison!`, 'special');
            c.pendingEuroCup = 'el';
          } else if (winRate >= 0.42) {
            addLog(`🇪🇺 Conference League qualifiziert für nächste Saison!`, 'neutral');
            c.pendingEuroCup = 'ecl';
          } else {
            c.pendingEuroCup = null;
            addLog(`Saison ${c.season - 1} abgeschlossen. Keine Europacup-Qualifikation.`, 'neutral');
          }
        } else {
          const flag = cfg.leagueFlags?.[c.leagueIndex] || '';
          addLog(`${flag} Saison ${c.season - 1} abgeschlossen. Bleibst in der ${leagueName(state)}.`, 'neutral');
        }
      } else {
        addLog(`Saison ${c.season - 1} abgeschlossen.`, 'neutral');
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
        ${!state._quickGame ? `<button class="btn btn-ghost btn-sm" style="margin-left:auto;font-size:.75rem" onclick="App.showExitMenu()">&#x23CF;&#xFE0F; Beenden</button>` : ''}
      </div>
    `;
  }

  function showExitMenu() {
    const modal = document.createElement('div');
    modal.className = 'modal-bg';
    modal.innerHTML = `
      <div class="modal">
        <h3>🏠 Spiel beenden</h3>
        <p style="margin-bottom:20px">Was möchtest du tun?</p>
        <div class="modal-btns" style="flex-direction:column;gap:10px">
          <button class="btn btn-primary" onclick="App._saveAndQuit()">
            💾 Speichern &amp; zum Menü
            <div style="font-size:.75rem;font-weight:400;margin-top:3px">Fortschritt wird gespeichert</div>
          </button>
          <button class="btn btn-ghost" onclick="App._quitNoSave()">
            🗑️ Beenden ohne speichern
            <div style="font-size:.75rem;font-weight:400;margin-top:3px">Alle ungespeicherten Änderungen gehen verloren</div>
          </button>
          <button class="btn btn-ghost btn-sm" onclick="this.closest('.modal-bg').remove()">← Zurück zum Spiel</button>
        </div>
      </div>`;
    document.body.appendChild(modal);
  }

  function _saveAndQuit() {
    document.querySelector('.modal-bg')?.remove();
    saveGame();
    state = null;
    showTitle();
  }

  function _quitNoSave() {
    document.querySelector('.modal-bg')?.remove();
    // State reverts to last persisted save (don’t touch localStorage)
    state = null;
    showTitle();
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
    const saves = allSaves();
    const savesHtml = saves.length === 0 ? '' : `
      <div style="margin-top:28px;max-width:480px;margin-left:auto;margin-right:auto">
        <div style="font-size:.8rem;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:10px">💾 Gespeicherte Karrieren</div>
        ${saves.map(s => `
          <div class="card" style="display:flex;align-items:center;gap:14px;margin-bottom:10px;padding:14px 18px">
            <span style="font-size:1.6rem">${CONFIG[s.sport].icon}</span>
            <div style="flex:1;min-width:0">
              <div style="font-weight:700">${s.player.name}</div>
              <div style="color:var(--muted);font-size:.8rem">${CONFIG[s.sport].leagues[s.career.leagueIndex]} • Saison ${s.career.season} • Alter ${s.player.age}</div>
            </div>
            <button class="btn btn-primary btn-sm" onclick="App.continueGame('${s.player.name}')">Laden</button>
            <button class="btn btn-ghost btn-sm" onclick="App.confirmDeleteSave('${s.player.name}')" title="Speicherstand l\u00f6schen">🗑️</button>
          </div>`).join('')}
      </div>`;
    render(`
      <div class="screen title-screen">
        <h1>🏟️ Sports Career</h1>
        <p class="subtitle">Starte deine Karriere als Profi-Sportler</p>
        <div style="margin-bottom:20px">
          <button class="btn btn-ghost" style="border-color:var(--gold);color:var(--gold);font-size:1rem;padding:12px 32px" onclick="App.showQuickGame()">
            ⚡ Quick Game — sofort losspielen
          </button>
        </div>
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
        ${savesHtml}
      </div>
    `);
  }

  // ── SCREEN: QUICK GAME ──────────────────────────
  function showQuickGame() {
    render(`
      <div class="screen">
        <div class="card" style="text-align:center;padding:32px 24px">
          <h2 style="margin-bottom:8px">⚡ Quick Game</h2>
          <p style="color:var(--muted);margin-bottom:28px">Ein Spiel, kein Speichern, kein Setup — einfach spielen.</p>
          <div class="sport-cards" style="max-width:400px;margin:0 auto 28px">
            <div class="sport-card football" onclick="App.startQuickGame('football')">
              <span class="sport-icon">⚽</span>
              <h2>Fussball</h2>
              <p>Schnelles Match</p>
            </div>
            <div class="sport-card basketball" onclick="App.startQuickGame('basketball')">
              <span class="sport-icon">🏀</span>
              <h2>Basketball</h2>
              <p>Schnelles Match</p>
            </div>
          </div>
          <button class="btn btn-ghost" onclick="App.showTitle()">← Zurück</button>
        </div>
      </div>
    `);
  }

  function startQuickGame(sport) {
    const cfg = CONFIG[sport];
    const isBasketball = sport === 'basketball';
    // Auto-generate a random player
    const firstNames = ['Max', 'Leon', 'Felix', 'Luca', 'Noah', 'Elias', 'Jonas', 'Tim', 'Ben', 'Jan'];
    const lastNames = ['Müller', 'Schmidt', 'Weber', 'Wagner', 'Fischer', 'Becker', 'Hoffmann', 'Koch', 'Richter', 'Klein'];
    const name = firstNames[rand(0, firstNames.length-1)] + ' ' + lastNames[rand(0, lastNames.length-1)];
    const pos = cfg.positions[rand(0, cfg.positions.length-1)];
    // Temp state (not saved)
    const baseStats = {};
    cfg.stats.forEach(s => { baseStats[s] = isBasketball ? rand(45, 65) : rand(30, 55); });
    const startLeague = cfg.startLeagueIndex ?? 0;
    const teams = isBasketball ? cfg.teamsByLeague[startLeague] : (cfg.teamsByLeague?.[startLeague] || cfg.teamNames);
    const myTeam = teams[rand(0, teams.length-1)];
    state = {
      sport,
      _quickGame: true,
      player: {
        name, position: pos, age: isBasketball ? rand(19,25) : rand(18,24),
        energy: 100, morale: 80, fame: rand(10,30),
        money: 0, totalEarned: 0,
        stats: baseStats, skillPoints: 0,
      },
      career: {
        leagueIndex: startLeague, teamName: myTeam,
        season: 1, seasons: 0, week: 1, weeksPerSeason: 24,
        wins: 0, losses: 0, draws: 0,
        goals: 0, assists: 0, promotions: 0, relegations: 0, bestMatchGoals: 0,
      },
      achievements: [], log: [], seasonLog: [],
    };
    // Play match immediately
    playMatch(true);
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

    const tabDefs = ['home', 'stats', 'log', 'achievements'];
    if (state.sport === 'basketball') tabDefs.splice(1, 0, 'standings');
    const tabLabels = { home: '🏠 Übersicht', standings: '📊 Tabelle', stats: '📌 Stats', log: '📋 Log', achievements: '🏆 Erfolge' };
    const tabs = tabDefs.map(t => `
      <button class="tab ${t === activeTab ? 'active' : ''}" onclick="App.showHub('${t}')">${tabLabels[t]}</button>`).join('');

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

    if (activeTab === 'standings') {
      const rows = getBBTableRows();
      const c = state.career;
      const inPlayoffs = c.playoffs !== null;
      const regularWeeks = c.regularSeasonWeeks || 20;
      const isPlayoffPhase = c.week > regularWeeks;
      const playoffRoundNames = ['', '1. Runde (Best-of-7)', 'Conference Semifinal', 'Conference Final', 'NBA Finals'];

      // Playoff bracket display
      const playoffHtml = inPlayoffs ? (() => {
        const pl = c.playoffs;
        const rname = playoffRoundNames[pl.round] || `Runde ${pl.round}`;
        const series = pl.bracket.find(s => s.teamA === c.teamName || s.teamB === c.teamName);
        if (!series) return `<div class="card" style="text-align:center;color:var(--muted)">Ausgeschieden — Saison vorbei.</div>`;
        const isA = series.teamA === c.teamName;
        const myW = isA ? series.winsA : series.winsB;
        const oppW = isA ? series.winsB : series.winsA;
        const opp  = isA ? series.teamB : series.teamA;
        return `
          <div class="card" style="border-color:var(--basketball)">
            <div style="font-size:.75rem;color:var(--basketball);text-transform:uppercase;font-weight:700;margin-bottom:8px">🏆 PLAYOFFS — ${rname}</div>
            <div style="display:flex;align-items:center;justify-content:space-between;gap:12px">
              <div style="text-align:center">
                <div style="font-weight:900;font-size:2rem;color:var(--football)">${myW}</div>
                <div style="font-size:.8rem;font-weight:700">${c.teamName}</div>
              </div>
              <div style="color:var(--muted);font-size:1.2rem">vs</div>
              <div style="text-align:center">
                <div style="font-weight:900;font-size:2rem">${oppW}</div>
                <div style="font-size:.8rem;color:var(--muted)">${opp}</div>
              </div>
            </div>
            <div style="font-size:.78rem;color:var(--muted);margin-top:8px;text-align:center">Erster zu 4 Siegen gewinnt die Serie</div>
          </div>`;
      })() : '';

      const tableHtml = `
        <div class="card">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
            <h3 style="margin:0">${leagueName(state)} Standings</h3>
            <span style="font-size:.78rem;color:var(--muted)">${isPlayoffPhase ? '🏆 Playoff-Phase' : `Woche ${c.week}/${regularWeeks} Regular Season`}</span>
          </div>
          <table class="table">
            <tr><th>#</th><th>Team</th><th>S</th><th>N</th><th>%</th><th></th></tr>
            ${rows.map((r, i) => `
              <tr class="${r.isPlayer ? 'highlight' : ''}">
                <td style="color:var(--muted);font-size:.8rem">${i + 1}</td>
                <td>${r.isPlayer ? '<strong>' + r.name + ' ★</strong>' : r.name}</td>
                <td>${r.w}</td>
                <td>${r.l}</td>
                <td style="color:${i < 8 ? 'var(--football)' : 'var(--muted)'}">${(r.pct * 100).toFixed(0)}%</td>
                <td>${i === 7 ? '<span style="font-size:.7rem;color:var(--muted)">─ Playoff Cut</span>' : ''}</td>
              </tr>`).join('')}
          </table>
          <div style="font-size:.75rem;color:var(--muted);margin-top:8px">★ = Dein Team • Top 8 qualifizieren sich für die Playoffs</div>
        </div>`;

      content = playoffHtml + tableHtml;
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
          ${state._quickGame ? `
            <div style="display:flex;gap:12px;justify-content:center">
              <button class="btn btn-primary" onclick="App.startQuickGame('${state.sport}')">⚡ Nochmal spielen</button>
              <button class="btn btn-ghost" onclick="App.showTitle()">← Zum Menü</button>
            </div>
          ` : `
            <button class="btn btn-primary btn-block" onclick="App.showHub('home')">← Zurück zur Übersicht</button>
          `}
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

  function continueGame(name) {
    state = loadGame(name);
    showHub();
  }

  function confirmDeleteSave(name) {
    const modal = document.createElement('div');
    modal.className = 'modal-bg';
    modal.innerHTML = `
      <div class="modal">
        <h3>⚠️ Karriere löschen?</h3>
        <p>Karriere <strong>${name}</strong> wird unwiderruflich gelöscht.</p>
        <div class="modal-btns">
          <button class="btn btn-danger" onclick="App._doDeleteSave('${name}')">Ja, löschen</button>
          <button class="btn btn-ghost" onclick="this.closest('.modal-bg').remove()">Abbrechen</button>
        </div>
      </div>`;
    document.body.appendChild(modal);
  }

  function _doDeleteSave(name) {
    clearSave(name);
    document.querySelector('.modal-bg')?.remove();
    showTitle();
  }

  function confirmNewGame() {
    // kept for compat — just go to title where user picks sport
    showTitle();
  }

  function _doNewGame() {
    document.querySelector('.modal-bg')?.remove();
    state = null;
    showTitle();
  }

  function playMatch(skipEnergyCheck = false) {
    if (!state || (!skipEnergyCheck && state.player.energy < 15)) {
      addLog('Zu müde für ein Spiel! Erst ausruhen.', 'bad');
      showHub('home');
      return;
    }
    // Basketball: if in playoffs, run playoff game instead
    if (state.sport === 'basketball' && state.career.playoffs) {
      const res = simPlayoffGame();
      if (res) {
        if (res.champion) {
          addLog(`🏆 NBA CHAMPION! ${state.career.teamName} sind Meister!`, 'special');
          state.career.week = state.career.weeksPerSeason + 1; // trigger season end
          endSeason();
        } else if (res.eliminated) {
          state.career.week = state.career.weeksPerSeason + 1;
          endSeason();
        } else {
          const verb = res.win ? 'Sieg' : 'Niederlage';
          addLog(`Playoffs R${state.career.playoffs?.round}: ${verb} — Serie ${res.myWins}:${res.oppWins} gegen ${res.oppName}`, res.win ? 'good' : 'bad');
          state.career.week++;
        }
        saveGame();
        showHub('standings');
        return;
      }
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
    showQuickGame,
    startQuickGame,
    showHub,
    startGame,
    continueGame,
    confirmDeleteSave,
    _doDeleteSave,
    confirmNewGame,
    _doNewGame,
    playMatch,
    skipStadiumIntro,
    startFootballMatch,
    abandonFootballMatch,
    _exitMatchSave,
    _exitMatchNoSave,
    showExitMenu,
    _saveAndQuit,
    _quitNoSave,
    train,
    doRest,
    useSkillPoint,
  };
})();

document.addEventListener('DOMContentLoaded', () => App.init());
