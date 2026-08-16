// ── Seeded PRNG (mulberry32) ──────────────────────────
// Deterministic, reproducible matches and seasons.
// Each match derives a sub-seed: fcn(seed, season, week)

export function createRNG(seed) {
  let s = seed >>> 0;
  return {
    next() {
      s |= 0;
      s = (s + 0x6d2b79f5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
    randInt(min, max) {
      return Math.floor(this.next() * (max - min + 1)) + min;
    },
    shuffle(arr) {
      const a = [...arr];
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(this.next() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    },
    getSeed() { return s; },
  };
}

/** Derive a per-match seed from the save seed + season + week. */
export function matchSeed(saveSeed, season, week) {
  // Simple hash: mix save seed, season, week into a new seed
  let h = (saveSeed * 1664525 + season * 1013904223 + week * 3271296777) >>> 0;
  return h;
}
