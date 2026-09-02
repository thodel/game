// ── Football season model ─────────────────────────────
// League table, fixtures, contracts, injuries, position weights and the age
// curve. Pure logic on `state.career.fb` — no DOM, every draw from an RNG —
// so a season is reproducible from the save and testable headless.
// Salvaged from the pre-split game.js (724a6e0) where it had been stranded.
import { clamp } from '../../core/utils.js';

export const LEAGUE_SIZE = 10;        // player's club + 9 rivals
export const SEASON_WEEKS = 24;       // 18 league + 2 cup rounds, spread over 22 weeks, then the off-season
const LEAGUE_WEEKS = [1, 2, 3, 4, 5, 6, 7, 9, 10, 11, 12, 13, 14, 15, 17, 18, 19, 20, 21, 22];
const CUP_WEEKS = [8, 16];

export const POSITION_WEIGHTS = {
  'Torwart':    { Tempo: 0.5, Technik: 0.8, Schuss: 0.2, Dribbling: 0.3, Kondition: 1.0, Kopfball: 1.2 },
  'Abwehr':     { Tempo: 0.9, Technik: 0.7, Schuss: 0.3, Dribbling: 0.5, Kondition: 1.1, Kopfball: 1.3 },
  'Mittelfeld': { Tempo: 1.0, Technik: 1.3, Schuss: 0.8, Dribbling: 1.1, Kondition: 1.2, Kopfball: 0.8 },
  'Stürmer':    { Tempo: 1.2, Technik: 1.0, Schuss: 1.5, Dribbling: 1.2, Kondition: 0.9, Kopfball: 1.1 },
};

// A keeper's Schuss barely matters; a striker's is what he is paid for.
export function positionRating(player) {
  const w = POSITION_WEIGHTS[player.position];
  const entries = Object.entries(player.stats);
  if (!w) return Math.round(entries.reduce((a, [, v]) => a + v, 0) / entries.length);
  let total = 0, sum = 0;
  for (const [stat, val] of entries) { const k = w[stat] ?? 1; total += val * k; sum += k; }
  return Math.round(total / sum);
}
export const trainingBonus = (player, stat) => ((POSITION_WEIGHTS[player.position] || {})[stat] || 1) > 1 ? 1 : 0;

// ── League and fixtures ───────────────────────────────
export function initLeagueTable(names, myTeam, leagueIndex, rng) {
  const rivals = rng.shuffle(names.filter(n => n !== myTeam)).slice(0, LEAGUE_SIZE - 1);
  const base = 35 + leagueIndex * 5;
  const row = (name, strength, isPlayer = false) => ({ name, strength, isPlayer, w: 0, d: 0, l: 0, pts: 0, gf: 0, ga: 0 });
  const table = rivals.map(n => row(n, rng.randInt(base - 10, base + 20)));
  table.push(row(myTeam, 40 + leagueIndex * 4, true));
  return table;
}

// Double round-robin against every rival, home and away, on a fixed calendar;
// two cup rounds against sides from outside the league.
export function generateFixtures(table, myTeam, rng) {
  const rivals = table.filter(t => t.name !== myTeam);
  const weeks = rng.shuffle(LEAGUE_WEEKS).slice(0, rivals.length * 2).sort((a, b) => a - b);
  const fixtures = [];
  rivals.forEach((r, i) => {
    fixtures.push({ week: weeks[i],                 opponent: r.name, home: true,  type: 'league', played: false });
    fixtures.push({ week: weeks[i + rivals.length], opponent: r.name, home: false, type: 'league', played: false });
  });
  CUP_WEEKS.forEach((week, i) => fixtures.push({ week, opponent: `Pokal-Gegner ${i + 1}`, home: rng.randInt(0, 1) === 1, type: 'cup', played: false }));
  return fixtures.sort((a, b) => a.week - b.week);
}

export const sortTable = table => table.slice().sort((a, b) => b.pts - a.pts || (b.gf - b.ga) - (a.gf - a.ga) || b.gf - a.gf);
export const tablePosition = table => sortTable(table).findIndex(t => t.isPlayer) + 1;
export const fixtureForWeek = (fb, week) => fb.fixtures.find(f => !f.played && f.week === week) || null;

// The rivals play each other while the player plays his game
export function simulateRivalFixtures(table, rng) {
  const rivals = table.filter(t => !t.isPlayer);
  if (rivals.length < 2) return;
  const n = rng.randInt(3, 4);
  for (let i = 0; i < n; i++) {
    const a = rng.randInt(0, rivals.length - 1);
    let b = rng.randInt(0, rivals.length - 2); if (b >= a) b++;
    const home = rivals[a], away = rivals[b];
    const hs = home.strength + rng.randInt(0, 30), as = away.strength + rng.randInt(0, 30);
    let hg, ag;
    if (hs > as)      { hg = rng.randInt(1, 3); ag = rng.randInt(0, Math.min(2, hg - 1)); }
    else if (hs < as) { ag = rng.randInt(1, 3); hg = rng.randInt(0, Math.min(2, ag - 1)); }
    else              { hg = ag = rng.randInt(0, 2); }
    recordRow(home, hg, ag); recordRow(away, ag, hg);
  }
}
export function recordRow(row, gf, ga) {
  row.gf += gf; row.ga += ga;
  if (gf > ga) { row.w++; row.pts += 3; } else if (gf === ga) { row.d++; row.pts += 1; } else row.l++;
}

// ── Contracts ─────────────────────────────────────────
export function generateContract(leagueIndex, rng) {
  return {
    wage: rng.randInt(200, 2000) * (leagueIndex + 1),
    lengthSeasons: rng.randInt(1, 3),
    bonusPerGoal: rng.randInt(50, 200),
  };
}
export function transferOffers(state, names, rng) {
  const c = state.career, fb = c.fb;
  if (c.seasons < 1) return [];
  const n = rng.randInt(0, 2);
  const pool = rng.shuffle(names.filter(t => t !== c.teamName)).slice(0, n);
  return pool.map(team => ({ team, wage: Math.round((fb.contract?.wage || 500) * (1.1 + rng.next() * 0.5)) }));
}

// ── Injuries and discipline ───────────────────────────
export function injuryRoll(player, rng) {
  if (player.injury) return null;
  const chance = player.energy < 30 ? 0.15 : 0.08;
  if (rng.next() >= chance) return null;
  const sev = rng.next();
  if (sev < 0.6) { const w = rng.randInt(1, 2); player.injury = { weeksLeft: w, type: 'minor' };    return `Muskelverletzung — ${w} Wochen Pause`; }
  if (sev < 0.9) { const w = rng.randInt(3, 5); player.injury = { weeksLeft: w, type: 'moderate' }; return `Bänderriss — ${w} Wochen Pause`; }
  const w = rng.randInt(6, 10);
  const hit = ['Tempo', 'Kondition'][rng.randInt(0, 1)];
  player.stats[hit] = clamp(player.stats[hit] - 2, 1, 99);   // a bad one leaves a mark
  player.injury = { weeksLeft: w, type: 'severe' };
  return `Knochenbruch — ${w} Wochen Pause (${hit} −2)`;
}
export function cardRoll(player, rng) {
  if (rng.next() >= 0.10) return null;
  player.yellowCards = (player.yellowCards || 0) + 1;
  if (player.yellowCards >= 3) { player.yellowCards = 0; player.suspension = (player.suspension || 0) + 1; return 'Dritte Gelbe Karte — eine Woche Sperre 🟨🟨🟨'; }
  return `Gelbe Karte (${player.yellowCards}/3) 🟨`;
}
export const unavailable = p => (p.injury && p.injury.weeksLeft > 0) ? `Verletzt — noch ${p.injury.weeksLeft} Woche${p.injury.weeksLeft === 1 ? '' : 'n'} 🤕`
                            : (p.suspension || 0) > 0 ? `Gesperrt — noch ${p.suspension} Woche${p.suspension === 1 ? '' : 'n'} 🟨` : null;

// Called once per week that passes
export function tickWeek(state) {
  const p = state.player, fb = state.career.fb;
  if (fb?.contract) { p.money += fb.contract.wage; p.totalEarned += fb.contract.wage; }
  const notes = [];
  if (p.injury) { p.injury.weeksLeft--; if (p.injury.weeksLeft <= 0) { p.injury = null; notes.push('Verletzung auskuriert — wieder fit 🏃'); } }
  if ((p.suspension || 0) > 0) p.suspension--;
  return notes;
}

// ── Age curve ─────────────────────────────────────────
// Physical stats peak then fade; technique keeps growing longer.
export function ageCurve(player, rng) {
  const notes = [];
  const bump = (stat, d) => { player.stats[stat] = clamp(player.stats[stat] + d, 1, 99); notes.push(`${stat} ${d > 0 ? '+' : ''}${d}`); };
  const physical = ['Tempo', 'Kondition'], technical = ['Technik', 'Dribbling'];
  if (player.age < 26)       { bump(rng.shuffle([...physical, ...technical])[0], rng.randInt(1, 2)); }
  else if (player.age <= 32) { if (rng.next() < 0.5) bump(technical[rng.randInt(0, 1)], 1); }
  else                        { bump(physical[rng.randInt(0, 1)], -rng.randInt(1, 2)); if (rng.next() < 0.5) bump(physical[rng.randInt(0, 1)], -1); }
  return notes;
}
export const RETIRE_OFFER_AGE = 35, RETIRE_FORCE_AGE = 40;

// ── Season outcome from the table ─────────────────────
export function seasonOutcome(state, leagueCount) {
  const c = state.career, fb = c.fb;
  const pos = tablePosition(fb.table), size = fb.table.length;
  if (pos === 1 && c.leagueIndex < leagueCount - 1) return { promoted: true, relegated: false, pos, note: `🏆 Tabellenführer — Aufstieg!` };
  if (pos >= size - 1 && c.leagueIndex > 0)          return { promoted: false, relegated: true, pos, note: `⬇️ Platz ${pos} — Abstieg` };
  return { promoted: false, relegated: false, pos, note: `Platz ${pos} in der Tabelle` };
}
