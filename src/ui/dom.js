// ── Core DOM helpers (no external deps) ───────────────

export const app = document.getElementById('app') ?? document.body;

export function render(html) { app.innerHTML = html; }

export function statColor(v) {
  if (v < 30) return 'low';
  if (v < 50) return 'mid';
  if (v < 75) return 'high';
  return 'max';
}

export function renderSeasonBar(career) {
  const pct = Math.round((career.week - 1) / career.weeksPerSeason * 100);
  const total = career.wins + career.losses + career.draws;
  const winRate = total > 0 ? Math.round((career.wins / total) * 100) : 0;
  return `
    <div class="card">
      <div style="display:flex;justify-content:space-between;margin-bottom:6px">
        <span style="font-size:.85rem;color:var(--muted)">Saisonfortschritt</span>
        <span style="font-size:.85rem;color:var(--muted)">Woche ${career.week}/${career.weeksPerSeason}</span>
      </div>
      <div class="season-progress"><div class="season-fill" style="width:${pct}%"></div></div>
      <div style="display:flex;gap:16px;margin-top:10px;font-size:.82rem;color:var(--muted)">
        <span>⚽ ${career.wins}S</span><span>⚖️ ${career.draws}U</span><span>❌ ${career.losses}V</span>
        <span style="margin-left:auto">Win-Rate: ${winRate}%</span>
      </div>
    </div>`;
}

export function renderStats(player) {
  return Object.entries(player.stats).map(([k, v]) => `
    <div class="stat-row">
      <span class="stat-name">${k}</span>
      <div class="stat-bar"><div class="stat-fill ${statColor(v)}" style="width:${Math.min(100, v)}%"></div></div>
      <span class="stat-num">${v}</span>
    </div>`).join('');
}
