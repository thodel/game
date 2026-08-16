// ── Achievements ──────────────────────────────────────
// Pure data — no side-effects. checkAchievements returns new unlock list.

export const ACHIEVEMENTS = [
  { id: 'first_win',    name: 'Erster Sieg!',      desc: 'Dein erstes Spiel gewonnen',          icon: '🏆',     check: s => s.career.wins >= 1 },
  { id: 'season1',      name: 'Erstes Comeback',   desc: 'Erste Saison abgeschlossen',          icon: '📅',     check: s => s.career.seasons >= 1 },
  { id: 'hat_trick',    name: 'Hattrick-Held',     desc: '3+ Tore in einem Spiel',              icon: '⚽⚽⚽',  check: s => s.career.bestMatchGoals >= 3 },
  { id: 'promoted',     name: 'Aufsteiger',        desc: 'Erste Liga-Beförderung',              icon: '📈',     check: s => s.career.promotions >= 1 },
  { id: 'mvp',          name: 'MVP',               desc: '10+ Spiele gewonnen',                 icon: '🌟',     check: s => s.career.wins >= 10 },
  { id: 'legend',       name: 'Legende',           desc: 'Top-Liga erreicht',                   icon: '👑',     check: s => s.sport === 'football' ? s.career.leagueIndex >= 5 : s.career.leagueIndex >= 1 },
  { id: 'nba_comeback', name: 'NBA Comeback',      desc: 'Nach G-League wieder in die NBA',    icon: '💪',     check: s => s.sport === 'basketball' && s.career.promotions >= 1 },
  { id: 'g_league',     name: 'G-League Grind',    desc: 'In die G-League abgestiegen',        icon: '😤',     check: s => s.sport === 'basketball' && s.career.relegations >= 1 },
  { id: 'nba_star',     name: 'NBA Star',          desc: '3 Saisons in der NBA überlebt',       icon: '⭐',     check: s => s.sport === 'basketball' && s.career.leagueIndex === 1 && s.career.seasons >= 3 },
  { id: 'max_contract', name: 'Max Contract',      desc: '10 Mio. € verdient',                  icon: '💎',     check: s => s.sport === 'basketball' && s.player.totalEarned >= 10000000 },
  { id: 'veteran',      name: 'Veteran',           desc: '5 Saisons gespielt',                  icon: '🎖️',     check: s => s.career.seasons >= 5 },
  { id: 'rich',         name: 'Millionär',         desc: '1.000.000 € verdient',                icon: '💰',     check: s => s.player.totalEarned >= 1000000 },
];

/**
 * Returns array of newly-unlocked achievement objects.
 * Mutates state.achievements in place.
 * @param {object} state - game state
 * @returns {object[]} newly unlocked achievements
 */
export function checkAchievements(state) {
  const unlocked = [];
  for (const ach of ACHIEVEMENTS) {
    if (!state.achievements.includes(ach.id) && ach.check(state)) {
      state.achievements.push(ach.id);
      unlocked.push(ach);
    }
  }
  return unlocked;
}

export function showAchievement(ach) {
  if (typeof document === "undefined") return; // node-safe
  const el = document.createElement('div');
  el.className = 'achievement-popup';
  el.innerHTML = `<div class="ach-title">🏆 Achievement unlocked</div>
    <div class="ach-name">${ach.icon} ${ach.name}</div>
    <div class="ach-desc">${ach.desc}</div>`;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3500);
}
