// ── Football adapter ──────────────────────────────────
import { clamp, avgStat, pickExcluding } from '../../core/utils.js';
import { checkAchievements, showAchievement } from '../../core/achievements.js';
import { matchSeed }                     from '../../core/rng.js';
import { addLog }                        from '../../ui/log.js'; // UI-side effect

const MATCH_EVENTS = {
  player:   ['Tor! ⚽', 'Traumpass 🎯', 'Elfer verwandelt 💥', 'Flanke zum Tor 🎪', 'Freistoss ✨'],
  opponent: ['Gegentor 😤', 'Elfmeter kassiert ⚠️', 'Rote Karte! 🟥', 'Eigentor 😱'],
  neutral:  ['Gelbe Karte 🟨', 'Pfostentreffer 😬', 'Grosschance vergeben 😤', 'Verlängerung! ⏱️'],
};

const TEAM_NAMES = [
  'FC Bayern','Dortmund','Leipzig','Leverkusen','Frankfurt','Stuttgart',
  'Wolfsburg','Hoffenheim','Freiburg','Mainz','Augsburg','Bochum',
  'Gladbach','Union Berlin','Heidenheim','Köln','Schalke','Hamburg',
];

const LEAGUES = ['Kreisliga','4. Liga','3. Liga','Regionalliga','2. Bundesliga','Bundesliga','Champions League'];

export const footballAdapter = {
  id: 'football',
  name: 'Fussball',
  icon: '⚽',
  color: 'football',
  positions: ['Torwart','Abwehr','Mittelfeld','Stürmer'],
  stats: ['Tempo','Technik','Schuss','Dribbling','Kondition','Kopfball'],
  leagues: LEAGUES,
  startLeagueIndex: 0,
  matchEvents: MATCH_EVENTS,
  teamNames: TEAM_NAMES,
  scoreLabel: 'Tore',
  // Where a career begins: stat range, age, fame, money, skill points
  starting: { statRange: [20, 40], age: [17, 17], fame: [0, 0], money: [500, 500], skillPoints: 3 },
  teamPool(leagueIndex) { return TEAM_NAMES; },
  actionCard: { label: 'Spiel starten', icon: '⚽', desc: '11 vs 11 im Stadion' },
  achievements: [
    { id: 'legend',    name: 'Legende',       desc: 'Top-Liga erreicht',       icon: '👑',    check: s => s.career.leagueIndex >= 5 },
    { id: 'hat_trick', name: 'Hattrick-Held', desc: '3+ Tore in einem Spiel', icon: '⚽⚽⚽', check: s => s.career.bestMatchGoals >= 3 },
  ],
  boxScoreFields: [
    { key: 'goals',     label: 'Tore' },
    { key: 'assists',   label: 'Vorlagen' },
  ],

  createMatch(state) {
    const opponent = pickExcluding(state._rng, TEAM_NAMES, state.career.teamName);
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

    const baseGoals = 3;
    const playerGoals = Math.round((effective / (effective + opponentStrength)) * baseGoals + rng.randInt(0, 3));
    const oppGoals    = Math.round((opponentStrength / (effective + opponentStrength)) * baseGoals + rng.randInt(0, 3));

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

    const oppNames = TEAM_NAMES.filter(n => n !== c.teamName);
    const opponent = oppNames[Math.floor(rng.next() * oppNames.length)];

    let result, money;
    if (playerGoals > oppGoals) {
      result = 'win';  c.wins++;
      money = rng.randInt(800, 2000) * (c.leagueIndex + 1);
    } else if (playerGoals === oppGoals) {
      result = 'draw'; c.draws++;
      money = rng.randInt(200, 600) * (c.leagueIndex + 1);
    } else {
      result = 'loss'; c.losses++;
      money = rng.randInt(100, 400) * (c.leagueIndex + 1);
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

    // The week advances here; the season rollover belongs to App.endSeason(),
    // which owns the season number, the bonus and the new club. Two rollovers
    // (this one used to call core/season.js's weaker endSeason) meant the season
    // counter never moved when a season was simulated.
    c.week++;

    const newAchs = checkAchievements(state);
    newAchs.forEach(showAchievement);

    return {
      playerGoals, oppGoals, result, opponent,
      events, money, personal, assists,
      score: `${playerGoals} : ${oppGoals}`,
    };
  },
};
