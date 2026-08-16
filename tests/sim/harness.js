// Runs the match engine with no browser: stubs the DOM surface it touches and
// drives its requestAnimationFrame loop with a synthetic clock.
//
// Rates only emerge over whole games, so this is the only way to see them. It
// has already caught a post spot inside the lane (an endless 3-second
// violation), passes skipping past receivers when a frame ran long, and
// shot-clock heaves making up 54% of all attempts.
const FRAME_MS = 16.7;

export async function playBasketballGame({ quarterMinutes = 12, homeStrength = 76, awayStrength = 76, human, maxFrames = 400000 } = {}) {
  const noop = () => {};
  const ctx = new Proxy({}, {
    get: (_, k) => {
      if (k === 'canvas') return { width: 960, height: 540 };
      if (k === 'measureText') return () => ({ width: 10 });
      if (k === 'createLinearGradient' || k === 'createRadialGradient') return () => ({ addColorStop: noop });
      return noop;
    },
    set: () => true,
  });
  const canvas = { width: 960, height: 540, getContext: () => ctx };

  let pending = null, now = 0, timers = [], result = null;
  globalThis.document = {
    getElementById: id => (id === 'bb-canvas' ? canvas : null),
    createElement: () => ({ classList: { add: noop, remove: noop }, style: {}, appendChild: noop }),
    addEventListener: noop,
  };
  globalThis.window = { addEventListener: noop, removeEventListener: noop };
  globalThis.performance = { now: () => now };
  globalThis.requestAnimationFrame = cb => { pending = cb; return 1; };
  globalThis.cancelAnimationFrame = () => { pending = null; };
  globalThis.setTimeout = (cb, ms) => { timers.push({ cb, at: now + (ms || 0) }); return timers.length; };

  const { BasketballEngine } = await import('../../src/sports/basketball/engine.js');
  BasketballEngine.start({
    canvasId: 'bb-canvas', quarterMinutes, autoHuman: true,
    home: { name: 'Home', strength: homeStrength },
    away: { name: 'Away', strength: awayStrength },
    human: human || {
      name: 'Test Player', number: 23, position: 'Small Forward', energy: 100,
      ratings: { speed: 70, handle: 68, three: 72, defense: 65, rim: 70, iq: 70, reb: 62, ft: 74 },
    },
    onFinish: r => { result = r; },
  });

  let frames = 0;
  while (pending && !result && frames < maxFrames) {
    const cb = pending; pending = null;
    now += FRAME_MS; frames++;
    timers = timers.filter(t => { if (t.at <= now) { t.cb(); return false; } return true; });
    cb(now);
  }
  if (!result) throw new Error(`match never finished after ${frames} frames`);
  return result;
}
