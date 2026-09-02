// ── Football career hooks ─────────────────────────────
// The app shell never asks which sport it is; it calls these. The season
// model (table, fixtures, contract, injuries, ageing) lives in season.js.
import { createRNG, matchSeed } from '../../core/rng.js';
import { saveGame }   from '../../core/persistence.js';
import { clamp, fmt } from '../../core/utils.js';
import { addLog }     from '../../ui/log.js';
import { render }     from '../../ui/dom.js';
import { footballAdapter } from './index.js';
import * as S from './season.js';

const seasonRNG = (state, salt) => createRNG(matchSeed(state._saveSeed || 42, state.career.season, salt));

// Lazily build the season structure; an old save gets one on first use.
export function ensureSeason(state) {
  const c = state.career;
  const stale = !c.fb || c.fb.season !== c.season || c.fb.team !== c.teamName || c.fb.leagueIndex !== c.leagueIndex;
  if (stale) {
    const rng = seasonRNG(state, 777);
    const table = S.initLeagueTable(footballAdapter.teamPool(c.leagueIndex), c.teamName, c.leagueIndex, rng);
    c.fb = {
      season: c.season, team: c.teamName, leagueIndex: c.leagueIndex,
      table, fixtures: S.generateFixtures(table, c.teamName, rng),
      contract: c.fb?.contract && c.fb.contractCarried ? c.fb.contract : S.generateContract(c.leagueIndex, rng),
      contractCarried: false,
      offers: c.fb?.offers || [], retirement: c.fb?.retirement || null,
    };
    c.weeksPerSeason = S.SEASON_WEEKS;
    state.player.injury = state.player.injury ?? null;
    state.player.suspension = state.player.suspension ?? 0;
    state.player.yellowCards = state.player.yellowCards ?? 0;
    saveGame(state);
  }
  return c.fb;
}

// Everything a finished match does to the season: table row, the rivals'
// results, the fixture ticked off, injury and card rolls, the goal bonus.
export function afterMatch(state, { result, myGoals, oppGoals, personal, rng }) {
  const c = state.career, p = state.player, fb = ensureSeason(state);
  const fx = S.fixtureForWeek(fb, c.week);
  if (fx) { fx.played = true; fx.result = `${myGoals}:${oppGoals}`; }
  if (!fx || fx.type === 'league') {
    const row = fb.table.find(t => t.isPlayer);
    if (row) S.recordRow(row, myGoals, oppGoals);
  }
  S.simulateRivalFixtures(fb.table, rng);
  if (fb.contract && personal > 0) { const bonus = fb.contract.bonusPerGoal * personal; p.money += bonus; p.totalEarned += bonus; }
  const hurt = S.injuryRoll(p, rng); if (hurt) addLog(state, `⚠️ ${hurt}`, 'bad');
  const card = S.cardRoll(p, rng);   if (card) addLog(state, card, card.includes('Sperre') ? 'bad' : 'neutral');
}

function advanceWeek(state, App) {
  const c = state.career;
  S.tickWeek(state).forEach(n => addLog(state, n, 'good'));
  c.week++;
  if (c.week > c.weeksPerSeason) App.endSeason();
}

export const careerHooks = {
  playMatch(state, App) {
    const c = state.career, p = state.player, fb = ensureSeason(state);
    const out = S.unavailable(p);
    if (out) { addLog(state, `${out} — die Mannschaft spielt ohne dich.`, 'bad'); return simulateWeek(state, App); }
    if (!S.fixtureForWeek(fb, c.week)) {
      addLog(state, c.week > 22 ? 'Saisonpause — Zeit für Vorbereitung ⛷️' : 'Spielfreie Woche — trainiere oder ruh dich aus.', 'neutral');
      advanceWeek(state, App); saveGame(state); return App.showHub();
    }
    App.showFootballMatch();   // the live 11-a-side match lives in the shell
  },

  // Training or rest spends the week: wages come in, injuries heal
  spendDay(state, App) { ensureSeason(state); advanceWeek(state, App); return true; },

  simSeason(state, App) {
    const c = state.career, season = c.season;
    let guard = 0;
    // stop at the rollover: App.endSeason() resets the week, which would loop on
    while (c.season === season && c.week <= c.weeksPerSeason && guard++ < 40) simulateWeek(state, App, true);
    saveGame(state);
    App.showHub();
  },

  hubSection(state) {
    const c = state.career, p = state.player, fb = ensureSeason(state);
    const sorted = S.sortTable(fb.table), pos = S.tablePosition(fb.table);
    const next = fb.fixtures.filter(f => !f.played && f.week >= c.week).slice(0, 3);
    const out = S.unavailable(p);
    const prompts = renderPrompts(state);
    return `${prompts}
    <div class="card">
      <div style="font-size:.8rem;color:var(--muted);margin-bottom:8px">📋 TABELLE — ${footballAdapter.leagues[c.leagueIndex]} · Platz ${pos} · Rating ${S.positionRating(p)} (${p.position})</div>
      <div class="standings-scroll"><table class="standings fb-table"><thead><tr><th>#</th><th>Verein</th><th>Sp</th><th>S</th><th>U</th><th>N</th><th>TD</th><th>Pkt</th></tr></thead>
      <tbody>${sorted.map((t, i) => `<tr class="${t.isPlayer ? 'me' : i === 0 ? 'cut-playoff' : i === sorted.length - 3 ? 'cut-playin' : ''}">
        <td>${i + 1}</td><td>${t.isPlayer ? '★ ' : ''}${t.name}</td><td>${t.w + t.d + t.l}</td><td>${t.w}</td><td>${t.d}</td><td>${t.l}</td>
        <td>${t.gf - t.ga > 0 ? '+' : ''}${t.gf - t.ga}</td><td><b>${t.pts}</b></td></tr>`).join('')}</tbody></table></div>
      <div style="font-size:.72rem;color:var(--muted);margin-top:6px">Platz 1 steigt auf · die letzten zwei steigen ab</div>
    </div>
    <div class="card">
      <div style="font-size:.8rem;color:var(--muted);margin-bottom:8px">📅 NÄCHSTE SPIELE${out ? ` · <span style="color:var(--danger)">${out}</span>` : ''}</div>
      <div class="fixture-list">${next.length ? next.map(f => `<div class="fixture ${f.type === 'cup' ? 'b2b' : ''}"><b>Wo ${f.week}</b><span>${f.home ? 'vs' : '@'} ${f.opponent}</span><i>${f.type === 'cup' ? '🏆 Pokal' : 'Liga'}</i></div>`).join('') : '<div class="fixture"><b>—</b><span>Saisonpause</span><i></i></div>'}</div>
      ${fb.contract ? `<div style="font-size:.78rem;color:var(--muted);margin-top:8px">📄 Vertrag: €${fmt(fb.contract.wage)}/Woche · Torbonus €${fmt(fb.contract.bonusPerGoal)} · Alter ${p.age}</div>` : ''}
    </div>`;
  },

  matchScreen() { return null; },
  afterMatch,
  seasonOutcome,
  hudExtras(state) {
    const p = state.player, out = S.unavailable(p);
    return out ? `<div class="hud-block" style="color:var(--danger)"><div class="hud-label">${p.injury ? '🤕 Verletzt' : '🟨 Gesperrt'}</div><div class="hud-value">${p.injury ? p.injury.weeksLeft : p.suspension}W</div></div>` : '';
  },
};

// A week the player does not play live: the team's fixture resolves headless,
// with the player benched when injured or suspended.
function simulateWeek(state, App, quiet = false) {
  const c = state.career, fb = ensureSeason(state);
  const fx = S.fixtureForWeek(fb, c.week);
  if (fx) {
    const rng = createRNG(matchSeed(state._saveSeed || 42, c.season, 100 + c.week));
    const r = footballAdapter.simulateHeadless(state, { rng, opponent: fx.opponent, seed: rng.getSeed(), benched: !!S.unavailable(state.player) });
    afterMatch(state, { result: r.result, myGoals: r.playerGoals, oppGoals: r.oppGoals, personal: r.personal, rng });
    if (!quiet) addLog(state, `${fx.opponent}: ${r.score}`, r.result === 'win' ? 'good' : r.result === 'loss' ? 'bad' : 'neutral');
  } else {
    // the headless sim advanced the week itself; a free week has to be spent here
    advanceWeek(state, App);
    return;
  }
  // the sim advanced c.week; the weekly tick still has to run for it
  S.tickWeek(state).forEach(n => addLog(state, n, 'good'));
  if (c.week > c.weeksPerSeason) App.endSeason();
  if (!quiet) { saveGame(state); App.showHub(); }
}

// ── Season end: table decides, contract renews, players age ───────────────
export function seasonOutcome(state) {
  const c = state.career, p = state.player, fb = ensureSeason(state);
  const rng = seasonRNG(state, 999);
  const out = S.seasonOutcome(state, footballAdapter.leagues.length);
  addLog(state, `Saison ${c.season}: ${out.note}`, out.promoted ? 'special' : out.relegated ? 'bad' : 'neutral');
  // the contract runs its course; a new one waits at the new club or the same one
  fb.contract.lengthSeasons--;
  const expired = fb.contract.lengthSeasons <= 0;
  const notes = S.ageCurve(p, rng);
  if (notes.length) addLog(state, `Ein Jahr älter (${p.age + 1}): ${notes.join(', ')}`, 'neutral');
  fb.offers = S.transferOffers(state, footballAdapter.teamPool(c.leagueIndex + (out.promoted ? 1 : out.relegated ? -1 : 0)), rng);
  fb.retirement = p.age + 1 >= S.RETIRE_FORCE_AGE ? 'forced' : p.age + 1 >= S.RETIRE_OFFER_AGE ? 'offer' : null;
  fb.contractCarried = !expired && !out.promoted && !out.relegated;
  if (fb.contractCarried) fb.contract.lengthSeasons = Math.max(1, fb.contract.lengthSeasons);
  return out;
}

function renderPrompts(state) {
  const fb = state.career.fb, p = state.player;
  let html = '';
  if (fb.retirement === 'forced') html += `<div class="card" style="border-color:var(--gold)"><h3>🎖️ Zeit, aufzuhören</h3><p style="color:var(--muted)">Mit ${p.age} ist Schluss. Deine Karriere wandert in die Hall of Fame.</p><button class="btn btn-primary btn-block" onclick="App.fbRetire()">Karriere beenden</button></div>`;
  else if (fb.retirement === 'offer') html += `<div class="card" style="border-color:var(--gold)"><h3>🎖️ Rente?</h3><p style="color:var(--muted)">Du bist ${p.age}. Noch eine Saison, oder in die Hall of Fame?</p><div class="gameday-actions"><button class="btn btn-primary" onclick="App.fbRetire()">Karriere beenden</button><button class="btn btn-ghost" onclick="App.fbKeepPlaying()">Weiterspielen</button></div></div>`;
  if (fb.offers?.length) html += `<div class="card" style="border-color:var(--gold)"><h3>📤 Transferangebote</h3>${fb.offers.map((o, i) => `<div class="fixture"><b>${fmt(o.wage)}€/Wo</b><span>${o.team}</span><i><button class="btn btn-primary btn-sm" onclick="App.fbAcceptTransfer(${i})">Annehmen</button></i></div>`).join('')}<button class="btn btn-ghost btn-sm btn-block" onclick="App.fbDeclineOffers()">Alle ablehnen</button></div>`;
  return html;
}

export function acceptTransfer(state, App, idx) {
  const c = state.career, fb = c.fb, offer = fb.offers?.[idx];
  if (!offer) return App.showHub();
  c.teamName = offer.team;
  fb.offers = [];
  fb.contract = { ...S.generateContract(c.leagueIndex, seasonRNG(state, 555)), wage: offer.wage };
  fb.contractCarried = true;
  c.fb = null; ensureSeason(state);          // a new club means a new table around it
  c.fb.contract = fb.contract; c.fb.contractCarried = true;
  addLog(state, `Transfer zu ${offer.team} — €${fmt(offer.wage)}/Woche 📤`, 'special');
  saveGame(state); App.showHub();
}
export function declineOffers(state, App) { state.career.fb.offers = []; saveGame(state); App.showHub(); }
export function keepPlaying(state, App)   { state.career.fb.retirement = null; saveGame(state); App.showHub(); }

export function retire(state, App) {
  const p = state.player, c = state.career;
  let hof = [];
  try { hof = JSON.parse(localStorage.getItem('sportsCareer_hallOfFame') || '[]'); } catch { hof = []; }
  hof.unshift({ name: p.name, sport: 'football', position: p.position, age: p.age, seasons: c.seasons, goals: c.goals, assists: c.assists,
                totalEarned: p.totalEarned, achievements: state.achievements.length, bestLeague: footballAdapter.leagues[c.leagueIndex], promotions: c.promotions });
  if (hof.length > 10) hof.pop();
  try { localStorage.setItem('sportsCareer_hallOfFame', JSON.stringify(hof)); } catch { /* storage unavailable */ }
  render(`<div class="screen"><div class="card" style="text-align:center;padding:32px 24px">
    <div style="font-size:3rem">🎖️</div><h2 style="margin:12px 0 4px">Karriere beendet</h2>
    <div style="color:var(--muted);margin-bottom:20px">${p.name} · ${p.position} · ${p.age} Jahre</div>
    <table class="table" style="margin:0 auto 20px;max-width:360px">
      <tr><td>🏁 Saisons</td><td><strong>${c.seasons}</strong></td></tr>
      <tr><td>⚽ Tore</td><td><strong>${c.goals}</strong></td></tr>
      <tr><td>🎯 Assists</td><td><strong>${c.assists}</strong></td></tr>
      <tr><td>📈 Aufstiege</td><td><strong>${c.promotions}</strong></td></tr>
      <tr><td>💰 Verdient</td><td><strong>€${fmt(p.totalEarned)}</strong></td></tr>
      <tr><td>🏆 Erfolge</td><td><strong>${state.achievements.length}</strong></td></tr>
    </table>
    <div style="font-size:.8rem;color:var(--muted);margin-bottom:14px">HALL OF FAME</div>
    <div class="fixture-list">${hof.slice(0, 5).map(h => `<div class="fixture"><b>${h.seasons} Sais.</b><span>${h.name} · ${h.position || ''}</span><i>${h.goals} Tore · ${h.bestLeague}</i></div>`).join('')}</div>
    <button class="btn btn-primary btn-block" style="margin-top:16px" onclick="App.doNewGame()">🚀 Neue Karriere</button>
  </div></div>`);
}
