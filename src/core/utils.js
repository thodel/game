// ── Core utilities ────────────────────────────────────
// No external deps. Used across all modules.

export function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

export function fmt(n) {
  return Math.round(n).toLocaleString('de-CH');
}

export function avgStat(player) {
  const vals = Object.values(player.stats);
  return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
}

export function pickOne(rng, arr) {
  return arr[Math.floor(rng.next() * arr.length)];
}

export function pickExcluding(rng, arr, exclude) {
  const filtered = arr.filter(n => n !== exclude);
  return filtered[Math.floor(rng.next() * filtered.length)];
}
