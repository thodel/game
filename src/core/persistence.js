// ── Persistence + Schema Migrations ──────────────────
export const CURRENT_SCHEMA = 1;
const SAVE_KEY = 'sportsCareerGame_v1';

// ── Migration chain ────────────────────────────────────
function migrateV1(raw) {
  return {
    sport: null, player: null, career: null,
    achievements: [], log: [], seasonLog: [],
    schemaVersion: 1,
    ...raw,
  };
}

const MIGRATIONS = [migrateV1];

// ── Public API ─────────────────────────────────────────
export function saveGame(state) {
  state.schemaVersion = CURRENT_SCHEMA;
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
  } catch (e) { console.error('saveGame failed', e); }
}

export function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    return migrate(raw);
  } catch (e) {
    console.warn('loadGame failed', e);
    return null;
  }
}

export function clearSave() { localStorage.removeItem(SAVE_KEY); }

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
    reader.onload = e => {
      try { resolve(migrate(JSON.parse(e.target.result))); }
      catch { reject(new Error('Ungültige Datei')); }
    };
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
  for (let v = version; v < MIGRATIONS.length; v++) {
    obj = MIGRATIONS[v](obj);
    obj.schemaVersion = v + 1;
  }
  return obj;
}
