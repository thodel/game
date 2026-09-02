// ── Basketball adapter ────────────────────────────────
import { clamp, avgStat, pickExcluding } from '../../core/utils.js';
import { endSeason }                     from '../../core/season.js';
import { checkAchievements, showAchievement } from '../../core/achievements.js';
import { matchSeed }                     from '../../core/rng.js';
import { addLog }                        from '../../ui/log.js';

// ─── Match event pools ────────────────────────────────────────────────────────
const MATCH_EVENTS = {
  player:   ['3-Pointer! 🎯','Slam Dunk! 💥','No-Look Pass 😎','Steal + Layup ⚡','And-One! 🔥','Game-Winner! 🚨','Triple-Double night 📊'],
  opponent: ['Blocked! 🛡️','Turnover 😤','Foul Trouble ⚠️','Benched by coach 🪑'],
  neutral:  ['Buzzer-Beater 🚨','Overtime! ⏱️','Technical Foul 😤','Timeout called ⏸️','Replay Review 📺'],
};

// ─── Team lists by league ─────────────────────────────────────────────────────
const TEAMS_BY_LEAGUE = [
  ['Lakeland Magic','Westchester Knicks','Long Island Nets','Stockton Kings','Santa Cruz Warriors',
   'Capital City Go-Go','Windy City Bulls','Cleveland Charge','Fort Wayne Mad Ants','Grand Rapids Gold',
   'Iowa Wolves','Memphis Hustle','Motor City Cruise','Oklahoma City Blue','Osceola Magic',
   'Raptors 905','Rio Grande Valley Vipers','Salt Lake City Stars','Sioux Falls Skyforce',
   'South Bay Lakers','Spurs Austin','Texas Legends','Agua Caliente Clippers','Birmingham Squadron','Delaware Blue Coats'],
  ['Lakers','Celtics','Warriors','Bulls','Heat','Knicks','Nets','Bucks','Suns','Clippers',
   'Nuggets','Mavericks','Spurs','Rockets','Thunder','Blazers','Jazz','Timberwolves','Kings',
   'Pelicans','Grizzlies','Pacers','76ers','Raptors','Cavaliers','Magic','Hornets','Hawks','Wizards','Pistons'],
];

const LEAGUES = ['G-League', 'NBA'];

// ─── Name pools (≥30 each) ────────────────────────────────────────────────────
const FIRST_NAMES = [
  'Marcus','Kevin','James','Stephen','Kyrie','Damian','Jayson','Giannis',
  'Joel','Nikola','Luka','Ja','Trae','Zion','Anthony','Kawhi','Paul',
  'Russell','Donovan','Bam','Tyler','Devin','Bradley','Khris','Fred',
  'OG','Aaron','Lonzo','Brandon','Darius','Chris',
];
const LAST_NAMES = [
  'Johnson','Williams','Davis','Brown','Wilson','Jones','Thompson','Garcia',
  'Martinez','Anderson','Taylor','Thomas','Jackson','White','Harris',
  'Martin','Lewis','Robinson','Walker','Hall','Young','Allen','King',
  'Wright','Scott','Green','Adams','Baker','Nelson','Carter',
];
const POSITIONS_5 = ['PG', 'SG', 'SF', 'PF', 'C'];

// ─── Archetype mappings ───────────────────────────────────────────────────────
const ARCHETYPE_BY_POS = {
  PG: 'playmaker', SG: 'shooter', SF: 'slasher', PF: 'big', C: 'big',
};

const ARCHETYPE_LABELS = {
  shooter:   { strength: '3-Pointer ⚠️',              keeper: 'SG (sharpshooting)' },
  slasher:   { strength: 'Drive & And-One 🔥',         keeper: 'SF (slashing)' },
  playmaker: { strength: 'Court Vision & Passing 👁️',  keeper: 'PG (playmaking)' },
  big:       { strength: 'Rim Protection 💪',           keeper: 'C (rim protection)' },
  defender:  { strength: 'Lockdown Defense 🛡️',        keeper: 'SF (defensive stopper)' },
};

// ─── Tendency builder ─────────────────────────────────────────────────────────
function makeTendency(position, rng) {
  const archetype = ARCHETYPE_BY_POS[position] || 'big';
  const bases = {
    shooter:   { threeRate: 0.65, driveRate: 0.15, passFirst: 0.20 },
    slasher:   { threeRate: 0.10, driveRate: 0.70, passFirst: 0.20 },
    playmaker: { threeRate: 0.25, driveRate: 0.35, passFirst: 0.75 },
    defender:  { threeRate: 0.15, driveRate: 0.30, passFirst: 0.40 },
    big:       { threeRate: 0.10, driveRate: 0.25, passFirst: 0.30 },
  };
  const b = bases[archetype];
  return {
    archetype,
    threeRate: clamp(b.threeRate + rng.next() * 0.2 - 0.1, 0, 1),
    driveRate: clamp(b.driveRate + rng.next() * 0.2 - 0.1, 0, 1),
    passFirst: clamp(b.passFirst + rng.next() * 0.2 - 0.1, 0, 1),
  };
}

// ─── Roster factory (Epic #48) ────────────────────────────────────────────────
export function makeRoster(rng, teamStrength) {
  const players  = [];
  const usedNames = new Set();
  for (let i = 0; i < 10; i++) {
    const isBench  = i >= 5;
    const position = POSITIONS_5[i % 5];
    const rating   = clamp(teamStrength + (isBench ? -15 : 0) + rng.randInt(-8, 8), 20, 95);
    let name;
    let attempts = 0;
    do {
      const fn = FIRST_NAMES[Math.floor(rng.next() * FIRST_NAMES.length)];
      const ln = LAST_NAMES[Math.floor(rng.next() * LAST_NAMES.length)];
      name = `${fn.charAt(0)}. ${ln}`;
      attempts++;
    } while (usedNames.has(name) && attempts < 30);
    usedNames.add(name);
    players.push({
      name, rating, position,
      fouls: 0, stamina: 100, minutesPlayed: 0,
      stats: { pts: 0, reb: 0, ast: 0 },
      tendency: makeTendency(position, rng),
    });
  }
  return players;
}

// ─── League roster initialiser (Epic #51) ────────────────────────────────────
export function initLeagueRoster(state, adapter, rng) {
  if (!state.league) state.league = { teams: {}, season: 1 };
  const leagueTeams = adapter.teamsByLeague[state.career.leagueIndex]
                   || adapter.teamsByLeague[1];
  leagueTeams.forEach(teamName => {
    if (!state.league.teams[teamName]) {
      const strength = clamp(50 + rng.randInt(-15, 15), 30, 75);
      state.league.teams[teamName] = {
        roster: makeRoster(rng, strength),
        w: 0, l: 0, pts: 0,
      };
    }
  });
}

// ─── League leaders (Epic #51) ────────────────────────────────────────────────
export function getLeagueLeaders(state) {
  if (!state.league) return { scorers: [], assisters: [] };
  const allPlayers = [];
  for (const [teamName, teamData] of Object.entries(state.league.teams)) {
    (teamData.roster || []).forEach(pl => allPlayers.push({ ...pl, team: teamName }));
  }
  const scorers   = [...allPlayers].sort((a, b) => b.stats.pts - a.stats.pts).slice(0, 5);
  const assisters = [...allPlayers].sort((a, b) => b.stats.ast - a.stats.ast).slice(0, 5);
  return { scorers, assisters };
}

// ─── Dominant archetype helper ────────────────────────────────────────────────
function getDominantArchetype(players) {
  const counts = {};
  players.forEach(pl => {
    const arch = pl.tendency?.archetype || 'big';
    counts[arch] = (counts[arch] || 0) + 1;
  });
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
}

// ─── Scouting info (Epic #52) ─────────────────────────────────────────────────
export function getScoutingInfo(oppRoster) {
  const starters = oppRoster.slice(0, 5);
  const arch   = getDominantArchetype(starters);
  const labels = ARCHETYPE_LABELS[arch] || ARCHETYPE_LABELS.big;
  const center = starters.find(pl => pl.position === 'C') || starters[4];
  return {
    archetype: arch,
    strength:  labels.strength,
    keeper:    center ? `${center.name} (${labels.keeper})` : labels.keeper,
    starters,
  };
}

// ─── Stamina multiplier ───────────────────────────────────────────────────────
function stamMult(stamina) {
  if (stamina < 20) return 0.70;
  if (stamina < 40) return 0.85;
  return 1.0;
}

// ─── Rotate bench players in (Epic #48) ──────────────────────────────────────
function doRotation(roster, onCourt, rng) {
  const numRot = rng.randInt(1, 2);
  for (let r = 0; r < numRot; r++) {
    // Prefer fatigued/fouled starters to sit
    const sitter = onCourt.find(pl => pl.fouls >= 4)
                || onCourt.find(pl => pl.stamina < 30)
                || onCourt[rng.randInt(0, 4)];
    const bench = roster.find(pl => !onCourt.includes(pl) && pl.stamina > 15);
    if (sitter && bench) {
      onCourt[onCourt.indexOf(sitter)] = bench;
    }
  }
}

// ─── Main adapter export ──────────────────────────────────────────────────────
export const basketballAdapter = {
  id: 'basketball',
  name: 'Basketball',
  icon: '🏀',
  color: 'basketball',
  positions: ['Point Guard','Shooting Guard','Small Forward','Power Forward','Center'],
  stats: ['Speed','Ballhandling','3-Pointer','Defense','Dunks','IQ'],
  leagues: LEAGUES,
  startLeagueIndex: 1,
  matchEvents: MATCH_EVENTS,
  teamsByLeague: TEAMS_BY_LEAGUE,
  teamNames: TEAMS_BY_LEAGUE[1],
  scoreLabel: 'Punkte',
  boxScoreFields: [
    { key: 'goals',        label: 'Punkte' },
    { key: 'assists',      label: 'Assists' },
    { key: 'minutesPlayed', label: 'Minuten' },
  ],

  // ── createMatch ──────────────────────────────────────
  createMatch(state) {
    const c = state.career;
    const leagueTeams = TEAMS_BY_LEAGUE[c.leagueIndex] || TEAMS_BY_LEAGUE[1];
    const opponent    = pickExcluding(state._rng, leagueTeams, state.career.teamName);
    return {
      opponent,
      seed: matchSeed(state._saveSeed || 42, state.career.season, state.career.week),
    };
  },

  // ── initLeagueRoster (adapter-level helper) ──────────
  initLeagueRoster(state, rng) {
    initLeagueRoster(state, this, rng);
  },

  // ── getScoutingInfo (adapter-level helper) ────────────
  getScoutingInfo(oppRoster) {
    return getScoutingInfo(oppRoster);
  },

  // ── simulateHeadless ─────────────────────────────────
  // ── simulateGame ─────────────────────────────────────
  // The simulation on its own: rosters, rotations, stamina, timeouts, quarter
  // scores and events for one game between the player's club and `ctx.opponent`.
  // It changes nothing about the career — no record, no money, no week — so the
  // season can resolve a scheduled fixture with it and apply the result itself.
  // Roster state (stamina, fouls, minutes, season stats) is match state and does
  // move, which is the whole point of persistent rosters (#51).
  simulateGame(state, ctx) {
    const { rng } = ctx;
    const p     = state.player;
    const c     = state.career;
    const skill = avgStat(p);
    const opponent = ctx.opponent;
    const isHome   = ctx.isHome !== false;

    if (!state.league) state.league = { teams: {}, season: c.season };
    const teamFor = (name, strength) => {
      if (!state.league.teams[name]) state.league.teams[name] = { roster: makeRoster(rng, strength), w: 0, l: 0, pts: 0 };
      return state.league.teams[name];
    };
    const leagueDiff       = c.leagueIndex * 8;
    const opponentStrength = ctx.opponentStrength ?? clamp(30 + leagueDiff + rng.randInt(-10, 10), 20, 95);
    // The player's club is a team, not one player: its strength comes from the
    // season when there is one, and the player's own line scales with skill below.
    const playerStrength   = ctx.homeStrength ?? clamp(skill + rng.randInt(-8, 8), 10, 100);
    const homeRoster = teamFor(c.teamName, playerStrength).roster;   // your own team-mates persist too
    const oppTeamData = teamFor(opponent, opponentStrength);
    const oppRoster  = oppTeamData.roster;

    // Second night of a back-to-back: the season knows; fall back to the week heuristic
    const isBackToBack = ctx.backToBack ?? (typeof c.lastMatchWeek === 'number' && c.lastMatchWeek === c.week - 1);
    const humanStartStamina = isBackToBack ? 75 : clamp(p.energy, 0, 100);

    const total    = c.wins + c.losses + c.draws;
    const winRate  = total > 0 ? c.wins / total : 0.5;
    const humanMinutes = Math.round(clamp(20 + winRate * 20, 20, 40));

    // Both rosters start a game fresh. Fatigue is modelled inside the game by the
    // drain and the rotations; letting only the opponent carry it between games
    // had them playing every night at 0.85 and handed the player's club ~70% of
    // games against an equal league.
    [homeRoster, oppRoster].forEach(r => r.forEach(pl => { pl.stamina = 100; pl.minutesPlayed = 0; pl.fouls = 0; }));

    const homeOnCourt = homeRoster.slice(0, 5);
    const awayOnCourt = oppRoster.slice(0, 5);
    const quarters = { home: [], away: [] };
    let homeScore = 0, awayScore = 0, humanPts = 0, humanAst = 0;
    let humanStamina = humanStartStamina;
    const events = [];
    let homeTOs = 4, awayTOs = 4;
    const venueHome = isHome ? 1.03 : 1.0, venueAway = isHome ? 1.0 : 1.03;

    for (let q = 1; q <= 4; q++) {
      const qStart = (q - 1) * 12;
      if ((q === 1 || q === 3) && homeTOs > 0) { events.push({ text: `Timeout ${c.teamName} ⏸️`, minute: qStart + 3, type: 'special' }); homeTOs--; }
      if ((q === 2 || q === 4) && awayTOs > 0) { events.push({ text: `Timeout ${opponent} ⏸️`, minute: qStart + 6, type: 'neutral' }); awayTOs--; }
      if (q > 1) { doRotation(homeRoster, homeOnCourt, rng); doRotation(oppRoster, awayOnCourt, rng); }

      const avgHomeSt = homeOnCourt.reduce((s, pl) => s + pl.stamina, 0) / 5;
      const avgAwaySt = awayOnCourt.reduce((s, pl) => s + pl.stamina, 0) / 5;
      const homeStM = stamMult(avgHomeSt), awayStM = stamMult(avgAwaySt), humanStM = stamMult(humanStamina);

      const scoreDiff = Math.abs(homeScore - awayScore);
      const isClutch  = q === 4 && scoreDiff <= 5;
      const clutchM   = isClutch ? 1.1 : 1.0;
      if (isClutch) events.push({ text: '🔥 Clutch Time! Alles auf dem Spiel!', minute: 42, type: 'special' });

      // Both clubs are rated the same way. The human's energy and morale shape the
      // human's own line (through humanStM and usage), not the whole team's —
      // otherwise a tired player's 96-rated club goes 11-71 over a season.
      const homeEff = playerStrength   * homeStM * venueHome;
      const awayEff = opponentStrength * awayStM * venueAway;
      const totalEff = (homeEff + awayEff) || 1;
      // 24 a side plus the 0-10 swing lands near a real 28-29 a quarter
      const baseQ  = 48;
      const qHome  = Math.round((homeEff / totalEff) * baseQ * clutchM + rng.randInt(0, 10));
      const qAway  = Math.round((awayEff / totalEff) * baseQ * clutchM + rng.randInt(0, 10));
      homeScore += qHome; awayScore += qAway;
      quarters.home.push(qHome); quarters.away.push(qAway);

      // The player's share of the team's scoring follows minutes and a usage rate
      // that grows with skill: a 57-rated rookie in 30 minutes lands near 14 a
      // game, a 80-rated starter in 38 near 24 — not 32 for everyone.
      const usage = clamp(0.16 + (skill - 50) / 220, 0.10, 0.34);
      const qHumanPts = Math.round(qHome * (humanMinutes / 48) * usage * humanStM * rng.randInt(8, 12) / 10);
      humanPts += qHumanPts;
      humanAst += Math.round(qHumanPts * rng.randInt(2, 6) / 10);

      [homeOnCourt, awayOnCourt].forEach(side => side.forEach((pl, idx) => {
        pl.stamina = clamp(pl.stamina - (idx < 5 ? rng.randInt(8, 12) : rng.randInt(4, 6)), 0, 100);
        pl.minutesPlayed += 12;
        if (rng.next() < 0.12) pl.fouls++;
      }));
      humanStamina = clamp(humanStamina - rng.randInt(8, 12), 0, 100);

      const oppArch = getDominantArchetype(awayOnCourt);
      if (oppArch === 'shooter' && rng.next() < 0.35)      events.push({ text: `3-Pointer Feuerwerk! 🎯 ${opponent}`, minute: qStart + rng.randInt(2, 11), type: 'opponent' });
      else if (oppArch === 'slasher' && rng.next() < 0.35) events.push({ text: `And-One! 🔥 ${opponent} zieht durch die Zone`, minute: qStart + rng.randInt(2, 11), type: 'opponent' });
      else if (oppArch === 'big' && rng.next() < 0.35)     events.push({ text: `Monster-Dunk! 💥 ${opponent} dominiert die Zone`, minute: qStart + rng.randInt(2, 11), type: 'opponent' });

      if (q === 4) {
        if (homeScore < awayScore && (awayScore - homeScore) <= 5 && homeTOs > 0) {
          homeTOs--;
          const foulCount = rng.randInt(2, 3);
          for (let f = 0; f < foulCount; f++) {
            const ftPts = rng.randInt(0, 2);
            homeScore += ftPts; quarters.home[3] += ftPts;
            events.push({ text: `Absichtliches Foul → Freiwürfe! 🆓 (+${ftPts} Pts)`, minute: 45 + f, type: 'special' });
          }
        }
        if (homeScore === awayScore) {
          if (rng.next() < 0.4) { homeScore += 2; quarters.home[3] += 2; events.push({ text: 'BUZZER-BEATER! 🚨 Dein Team trifft in letzter Sekunde!', minute: 48, type: 'player' }); }
          else                  { awayScore += 2; quarters.away[3] += 2; events.push({ text: 'Gegner trifft den Buzzer-Beater! 😤🏀', minute: 48, type: 'opponent' }); }
        }
      }
    }

    const numClassic = rng.randInt(2, 4);
    const shuffled = rng.shuffle([...MATCH_EVENTS.player, ...MATCH_EVENTS.opponent]);
    for (let i = 0; i < Math.min(numClassic, shuffled.length); i++) {
      const e = shuffled[i];
      events.push({ text: e, minute: rng.randInt(5, 46), type: MATCH_EVENTS.player.includes(e) ? 'player' : 'opponent' });
    }
    events.sort((a, b) => a.minute - b.minute);

    // Minutes to realistic targets: starters 30-38, bench 10-24
    [homeRoster, oppRoster].forEach(roster => roster.forEach((pl, i) => {
      pl.minutesPlayed = i < 5 ? clamp(pl.minutesPlayed + rng.randInt(6, 14), 30, 38)
                               : clamp(pl.minutesPlayed - rng.randInt(0, 8), 10, 24);
    }));

    // Season stats for the opposing roster (#51)
    oppRoster.forEach(pl => {
      pl.stats.pts += Math.round(awayScore * (pl.rating / 100) * rng.randInt(1, 4) / 10);
      pl.stats.ast += rng.randInt(0, 3);
      pl.stats.reb += rng.randInt(0, 5);
    });

    const personal = clamp(humanPts, 0, Math.max(homeScore, 1));
    const assists  = clamp(humanAst, 0, 20);
    const boxFor = (roster, teamScore) => {
      const ratingSum = roster.slice(0, 5).reduce((s, pl) => s + pl.rating, 0) || 1;
      return roster.slice(0, 5).map(pl => ({
        name: pl.name, position: pl.position, minutesPlayed: pl.minutesPlayed,
        pts: Math.max(0, Math.round(teamScore * (pl.rating / ratingSum) * (0.75 + rng.next() * 0.5))),
        reb: rng.randInt(1, 9), ast: rng.randInt(0, 7), fouls: pl.fouls,
      }));
    };

    return {
      homeScore, awayScore, quarters, events, opponent, isHome,
      human: { pts: personal, ast: assists, min: humanMinutes },
      boxScore: boxFor(homeRoster, Math.max(0, homeScore - personal)),
      oppBox:   boxFor(oppRoster, awayScore),
      scoutingInfo: getScoutingInfo(oppRoster),
    };
  },

  // ── simulateHeadless ─────────────────────────────────
  // Compatibility wrapper: the old all-in-one entry that also applied career
  // effects. The career now goes through the season (career.js), which calls
  // simulateGame() and records the result itself. Kept for tests and for any
  // caller that has no season; nothing in the app should reach it any more.
  simulateHeadless(state, ctx) {
    const { rng } = ctx;
    const cfg = this;
    const p = state.player, c = state.career;
    const leagueTeams = TEAMS_BY_LEAGUE[c.leagueIndex] || TEAMS_BY_LEAGUE[1];
    const opponent = ctx.opponent || (() => {
      const oppNames = leagueTeams.filter(n => n !== c.teamName);
      return oppNames[Math.floor(rng.next() * oppNames.length)];
    })();
    const sim = this.simulateGame(state, { ...ctx, opponent });
    const { homeScore, awayScore, events, human } = sim;

    const isNBA = c.leagueIndex === 1, isGLeague = c.leagueIndex === 0;
    let result, money;
    if (homeScore > awayScore) { result = 'win';  c.wins++;   money = isNBA ? rng.randInt(80000, 250000) : isGLeague ? rng.randInt(3000, 8000) : rng.randInt(800, 2000); }
    else                       { result = 'loss'; c.losses++; money = isNBA ? rng.randInt(15000, 50000)  : isGLeague ? rng.randInt(500, 1500)  : rng.randInt(100, 400); }
    c.goals += human.pts; c.assists += human.ast;
    if (human.pts > c.bestMatchGoals) c.bestMatchGoals = human.pts;
    p.money += money; p.totalEarned += money;
    p.energy = clamp(p.energy - rng.randInt(15, 30), 0, 100);
    p.morale = result === 'win' ? clamp(p.morale + rng.randInt(5, 15), 0, 100) : clamp(p.morale - rng.randInt(5, 12), 0, 100);
    p.fame  += result === 'win' ? rng.randInt(3, 8) : rng.randInt(0, 2);
    c.lastMatchWeek = c.week; c.week++;
    const opp = state.league.teams[opponent];
    if (result === 'win') opp.l++; else opp.w++;
    if (c.week > c.weeksPerSeason) {
      const { promoted, relegated } = endSeason(c, cfg.leagues.length);
      if (promoted)      { addLog(state, 'Aufstieg in die NBA! 🏀', 'good'); initLeagueRoster(state, cfg, rng); }
      else if (relegated) { addLog(state, 'Abstieg in die G-League…', 'bad'); initLeagueRoster(state, cfg, rng); }
    }
    checkAchievements(state).forEach(showAchievement);
    return {
      playerGoals: homeScore, oppGoals: awayScore, result, opponent, events, money,
      personal: human.pts, assists: human.ast, humanMinutes: human.min,
      score: `${homeScore} : ${awayScore}`, quarters: sim.quarters,
      boxScore: sim.boxScore, oppBox: sim.oppBox, scoutingInfo: sim.scoutingInfo,
    };
  },
};
