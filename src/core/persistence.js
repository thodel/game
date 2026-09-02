// ── Persistence: save slots + schema migrations ───────
// One slot per career, keyed by the player's name, plus a pointer to the slot
// that was played last. A Quick Game (state._quickGame) is never written.
export const CURRENT_SCHEMA = 1;
const PREFIX = 'sportsCareer_v2_';
const ACTIVE = 'sportsCareer_active';
const LEGACY_KEY = 'sportsCareerGame_v1';   // the single pre-slot save

const slug = name => String(name || 'unnamed').trim().replace(/\s+/g, '_');
export const saveKeyFor = name => PREFIX + slug(name);
const storage = () => (typeof localStorage !== 'undefined' ? localStorage : null);

// ── Migration chain ────────────────────────────────────
function migrateV1(raw) {
  return { sport: null, player: null, career: null, achievements: [], log: [], seasonLog: [], schemaVersion: 1, ...raw };
}
const MIGRATIONS = [migrateV1];

// ── Public API ─────────────────────────────────────────
export function saveGame(state) {
  if (!state || state._quickGame) return;          // a quick game leaves nothing behind
  state.schemaVersion = CURRENT_SCHEMA;
  const ls = storage(); if (!ls) return;
  try {
    const key = saveKeyFor(state.player?.name);
    ls.setItem(key, JSON.stringify(state));
    ls.setItem(ACTIVE, key);
  } catch (e) { console.error('saveGame failed', e); }
}

// The named career, or the one played last. A save from before slots existed
// is moved into a slot the first time it is seen.
export function loadGame(name) {
  const ls = storage(); if (!ls) return null;
  try {
    const key = name ? saveKeyFor(name) : ls.getItem(ACTIVE);
    let raw = key ? ls.getItem(key) : null;
    if (!raw && !name) {
      const legacy = ls.getItem(LEGACY_KEY);
      if (legacy) {
        const migrated = migrate(legacy);
        if (!migrated._loadError) { saveGame(migrated); ls.removeItem(LEGACY_KEY); return migrated; }
        return migrated;
      }
      return null;
    }
    if (!raw) return null;
    const state = migrate(raw);
    if (!state._loadError) ls.setItem(ACTIVE, key);
    return state;
  } catch (e) { console.warn('loadGame failed', e); return null; }
}

export function allSaves() {
  const ls = storage(); if (!ls) return [];
  const saves = [];
  for (let i = 0; i < ls.length; i++) {
    const k = ls.key(i);
    if (!k || !k.startsWith(PREFIX)) continue;
    try { const d = JSON.parse(ls.getItem(k)); if (d?.player?.name) saves.push(d); } catch { /* skip a broken slot */ }
  }
  return saves.sort((a, b) => (b.career?.season || 0) - (a.career?.season || 0) || String(a.player.name).localeCompare(String(b.player.name)));
}

export function clearSave(name) {
  const ls = storage(); if (!ls) return;
  const key = name ? saveKeyFor(name) : ls.getItem(ACTIVE);
  if (key) ls.removeItem(key);
  if (!name || ls.getItem(ACTIVE) === key) ls.removeItem(ACTIVE);
}
export const activeSave = () => loadGame();

export function exportSave(state) {
  state.schemaVersion = CURRENT_SCHEMA;
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = `sports-career-save-${Date.now()}.json`;
  a.click(); URL.revokeObjectURL(url);
}

export function importSave(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => { try { resolve(migrate(JSON.parse(e.target.result))); } catch { reject(new Error('Ungültige Datei')); } };
    reader.onerror = () => reject(new Error('Lesefehler'));
    reader.readAsText(file);
  });
}

export function migrate(rawJson) {
  let obj;
  try { obj = typeof rawJson === 'string' ? JSON.parse(rawJson) : rawJson; }
  catch { return { _loadError: 'CORRUPT_JSON' }; }
  const version = obj.schemaVersion || 0;
  if (version === CURRENT_SCHEMA) return obj;
  if (version > CURRENT_SCHEMA) return { _loadError: 'FUTURE_VERSION', version };
  for (let v = version; v < MIGRATIONS.length; v++) { obj = MIGRATIONS[v](obj); obj.schemaVersion = v + 1; }
  return obj;
}
