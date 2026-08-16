// ── Basketball adapter ────────────────────────────────
import { clamp, avgStat, pickExcluding } from '../../core/utils.js';
import { endSeason }                     from '../../core/season.js';
import { checkAchievements, showAchievement } from '../../core/achievements.js';
import { matchSeed }                     from '../../core/rng.js';
import { addLog }                        from '../../ui/log.js';

const MATCH_EVENTS = {
  player:   ['3-Pointer! 🎯','Slam Dunk! 💥','No-Look Pass 😎','Steal + Layup ⚡','And-One! 🔥','Game-Winner! 🚨','Triple-Double night 📊'],
  opponent: ['Blocked! 🛡️','Turnover 😤','Foul Trouble ⚠️','Benched by coach 🪑'],
  neutral:  ['Buzzer-Beater 🚨','Overtime! ⏱️','Technical Foul 😤','Timeout called ⏸️','Replay Review 📺'],
};

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

export const basketballAdapter = {
  id: 'basketball',
  name: 'Basketball',
  icon: '🏀',
  color: 'basketball',
  positions: ['Point Guard','Shooting Guard','Small Forward','Power Forward','Center'],
  stats: ['Speed','Ballhandling','3-Pointer','Defense','Dunks','IQ'],
  leagues: LEAGUES,
  startLeagueIndex: 1, // players start in NBA
  matchEvents: MATCH_EVENTS,
  teamsByLeague: TEAMS_BY_LEAGUE,
  teamNames: TEAMS_BY_LEAGUE[1],
  scoreLabel: 'Punkte',
  boxScoreFields: [
    { key: 'goals',   label: 'Punkte' },
    { key: 'assists', label: 'Assists' },
  ],

  createMatch(state) {
    const c = state.career;
    const leagueTeams = TEAMS_BY_LEAGUE[c.leagueIndex] || TEAMS_BY_LEAGUE[1];
    const opponent    = pickExcluding(state._rng, leagueTeams, state.career.teamName);
    return {
      opponent,
      seed: matchSeed(state._saveSeed || 42, state.career.season, state.career.week),
    };
  },

  simulateHeadless(state, ctx) {
    const { rng } = ctx;
    const cfg   = this;
    const p     = state.player;
    const c     = state.career;
    const skill = avgStat(p);
    const leagueDiff = c.leagueIndex * 8;
    const opponentStrength = clamp(30 + leagueDiff + rng.randInt(-10, 10), 20, 95);
    const playerStrength   = clamp(skill + rng.randInt(-8, 8), 10, 100);
    const energyFactor  = p.energy / 100;
    const moraleFactor  = p.morale / 100;
    const effective     = playerStrength * energyFactor * 0.7 + playerStrength * moraleFactor * 0.3;

    const baseGoals = 85;
    const playerGoals = Math.round((effective / (effective + opponentStrength)) * baseGoals + rng.randInt(0, 15));
    const oppGoals    = Math.round((opponentStrength / (effective + opponentStrength)) * baseGoals + rng.randInt(0, 15));

    const contribution = Math.round(playerGoals * (skill / 100) * rng.randInt(3, 8) / 10);
    const assists      = Math.round(contribution * rng.randInt(3, 7) / 10);
    const personal     = contribution - assists;

    const events = [];
    const numEvents = rng.randInt(4, 8);
    const shuffled = rng.shuffle([...MATCH_EVENTS.player, ...MATCH_EVENTS.opponent, ...MATCH_EVENTS.neutral]);
    for (let i = 0; i < Math.min(numEvents, shuffled.length); i++) {
      const e    = shuffled[i];
      const type = MATCH_EVENTS.player.includes(e) ? 'player'
                 : MATCH_EVENTS.opponent.includes(e) ? 'opponent' : 'neutral';
      events.push({ text: e, minute: rng.randInt(5, 90), type });
    }
    events.sort((a, b) => a.minute - b.minute);

    const leagueTeams = TEAMS_BY_LEAGUE[c.leagueIndex] || TEAMS_BY_LEAGUE[1];
    const oppNames    = leagueTeams.filter(n => n !== c.teamName);
    const opponent    = oppNames[Math.floor(rng.next() * oppNames.length)];

    const isNBA    = c.leagueIndex === 1;
    const isGLeague = c.leagueIndex === 0;
    let result, money;
    if (playerGoals > oppGoals) {
      result = 'win'; c.wins++;
      money = isNBA ? rng.randInt(80000, 250000) : isGLeague ? rng.randInt(3000, 8000) : rng.randInt(800, 2000);
    } else if (playerGoals === oppGoals) {
      result = 'draw'; c.draws++;
      money = isNBA ? rng.randInt(30000, 80000) : isGLeague ? rng.randInt(1000, 3000) : rng.randInt(200, 600);
    } else {
      result = 'loss'; c.losses++;
      money = isNBA ? rng.randInt(15000, 50000) : isGLeague ? rng.randInt(500, 1500) : rng.randInt(100, 400);
    }

    c.goals += personal;
    c.assists += assists;
    if (personal > c.bestMatchGoals) c.bestMatchGoals = personal;

    p.money       += money;
    p.totalEarned += money;
    p.energy       = clamp(p.energy - rng.randInt(15, 30), 0, 100);
    p.morale       = result === 'win'  ? clamp(p.morale + rng.randInt(5, 15), 0, 100)
                   : result === 'loss' ? clamp(p.morale - rng.randInt(5, 12), 0, 100)
                   : p.morale;
    p.fame        += result === 'win' ? rng.randInt(3, 8) : rng.randInt(0, 2);

    c.week++;
    if (c.week > c.weeksPerSeason) {
      const { promoted, relegated } = endSeason(c, cfg.leagues.length);
      if (promoted) addLog(state, 'Aufstieg in die NBA! 🏀', 'good');
      else if (relegated) addLog(state, 'Abstieg in die G-League…', 'bad');
    }

    const newAchs = checkAchievements(state);
    newAchs.forEach(showAchievement);

    return {
      playerGoals, oppGoals, result, opponent,
      events, money, personal, assists,
      score: `${playerGoals + 50} : ${oppGoals + 50}`,
    };
  },
};
