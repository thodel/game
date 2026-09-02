// Save slots (#71/#38): one slot per career, an active pointer, the pre-slot
// save migrated on first load, and a quick game that is never written.
import { describe, it, expect, beforeEach } from 'vitest';
import { saveGame, loadGame, clearSave, allSaves, saveKeyFor } from '../src/core/persistence.js';

function stubStorage() {
  const m = new Map();
  globalThis.localStorage = {
    getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k),
    clear: () => m.clear(), key: i => [...m.keys()][i] ?? null, get length() { return m.size; },
  };
  return m;
}
const career = (name, season = 1) => ({ sport: 'football', player: { name, age: 20, position: 'Abwehr' }, career: { season, leagueIndex: 0 }, achievements: [], log: [] });

describe('save slots', () => {
  let m; beforeEach(() => { m = stubStorage(); });

  it('keeps one slot per career and remembers the last one played', () => {
    saveGame(career('Anna')); saveGame(career('Ben', 3));
    expect(allSaves().map(s => s.player.name)).toEqual(['Ben', 'Anna']);   // most seasons first
    expect(loadGame().player.name).toBe('Ben');                             // the active one
    expect(loadGame('Anna').player.name).toBe('Anna');
    expect(loadGame().player.name).toBe('Anna');                            // loading makes it active
  });
  it('deletes one career without touching the others', () => {
    saveGame(career('Anna')); saveGame(career('Ben'));
    clearSave('Ben');
    expect(allSaves().map(s => s.player.name)).toEqual(['Anna']);
    expect(m.has(saveKeyFor('Ben'))).toBe(false);
  });
  it('moves a pre-slot save into a slot the first time it is seen', () => {
    m.set('sportsCareerGame_v1', JSON.stringify(career('Legacy', 2)));
    const s = loadGame();
    expect(s.player.name).toBe('Legacy');
    expect(m.has('sportsCareerGame_v1')).toBe(false);
    expect(m.has(saveKeyFor('Legacy'))).toBe(true);
    expect(allSaves()).toHaveLength(1);
  });
  it('never writes a quick game', () => {
    saveGame({ ...career('Quick'), _quickGame: true });
    expect(allSaves()).toHaveLength(0);
    expect(loadGame()).toBeNull();
  });
  it('survives a broken slot', () => {
    m.set(saveKeyFor('Broken'), '{not json'); saveGame(career('Ok'));
    expect(allSaves().map(s => s.player.name)).toEqual(['Ok']);
  });
});
