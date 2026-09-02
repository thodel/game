// The unit tests all passed while the app rendered a blank page: nothing
// exercised src/main.js, so three crashes lived there undetected — a bare
// showTitle() at boot, a hub reading career.seasonLog (it lives on state), and
// a footballAdapter that was never imported.
//
// This boots the real entry point against a minimal DOM and walks the screens
// a player actually touches.
import { describe, it, expect, beforeAll } from 'vitest';

function stubDom() {
  const el = () => ({
    innerHTML: '', value: '', textContent: '', dataset: {}, style: {},
    classList: { add() {}, remove() {}, contains: () => false },
    appendChild() {}, remove() {}, addEventListener() {}, click() {},
    getContext: () => new Proxy({}, { get: () => () => ({ addColorStop() {} }), set: () => true }),
    width: 960, height: 540,
  });
  const root = el();
  const store = new Map();
  globalThis.document = {
    getElementById: id => (id === 'app' ? root : el()),
    querySelector: () => el(),
    querySelectorAll: () => [],
    createElement: () => el(),
    addEventListener() {},
    body: root,
  };
  globalThis.window = { addEventListener() {}, removeEventListener() {}, App: undefined };
  globalThis.localStorage = {
    getItem: k => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: k => store.delete(k),
    clear: () => store.clear(),
  };
  globalThis.requestAnimationFrame = () => 1;
  globalThis.cancelAnimationFrame = () => {};
  globalThis.alert = () => {};
  globalThis.performance = globalThis.performance ?? { now: () => 0 };
  return root;
}

let root, App;

describe('app boots and navigates', () => {
  beforeAll(async () => {
    root = stubDom();
    await import('../src/main.js');
    App = globalThis.window.App;
  });

  it('exposes App and renders the title screen', () => {
    expect(App).toBeTypeOf('object');
    expect(root.innerHTML).toContain('Sports Career');
  });

  for (const sport of ['football', 'basketball']) {
    it(`plays a ${sport} career through hub, match, training and season`, () => {
      App.showCreate(sport);
      expect(root.innerHTML).toContain('Spieler erstellen');

      // confirmCreate reads the form; drive the state path directly instead
      globalThis.document.getElementById = id => (id === 'app' ? root : { value: 'Test Spieler', dataset: { pos: null } });
      globalThis.document.querySelector = () => ({ dataset: { pos: sport === 'football' ? 'Torwart' : 'Point Guard' } });
      App.confirmCreate(sport);
      expect(root.innerHTML).toContain('Test Spieler');

      App.doTraining(sport === 'football' ? 'Tempo' : '3-Pointer');
      expect(root.innerHTML).toContain('Test Spieler');

      App.doRest();
      App.doSimSeason();
      expect(root.innerHTML).toContain('Test Spieler');

      App.showHub();
      expect(root.innerHTML).toContain('Liga');

      App.doNewGame();
      expect(root.innerHTML).toContain('Sports Career');
    });
  }

  it('simulates a scheduled basketball fixture onto the broadcast screen', () => {
    globalThis.document.querySelector = () => ({ dataset: { pos: 'Point Guard' } });
    App.doNewGame();
    App.confirmCreate('basketball');
    App.doPlayMatch();                       // game day for fixture 1
    expect(root.innerHTML).toContain('SPIEL 1 VON');
    App.bbSimulate();
    expect(root.innerHTML).toContain('broadcast-linescore');
    expect(root.innerHTML).toContain('Q4');
    expect(root.innerHTML).not.toContain('NaN');
    // the box score shows the persistent roster, and the back button returns to the schedule
    expect(root.innerHTML).toContain('box-score');
    expect(root.innerHTML).toContain('App.bbGameDay()');
    // doBasketballMatch is the same path now — it must not advance outside the schedule
    const played = () => JSON.parse(globalThis.localStorage.getItem('sportsCareerGame_v1')).career.nba.games.filter(g => g.done).length;
    const before = played();
    App.doBasketballMatch();
    expect(played()).toBeGreaterThan(before);
  });

  it('resumes from a saved game without throwing', () => {
    globalThis.document.querySelector = () => ({ dataset: { pos: 'Point Guard' } });
    App.confirmCreate('basketball');
    expect(() => App.start()).not.toThrow();
    expect(root.innerHTML).toContain('Liga');
  });
});
