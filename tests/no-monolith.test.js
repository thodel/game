// #66: the game lives in src/. A root-level script would be dead code that
// nothing loads — the pre-split game.js sat there for weeks collecting work
// that never reached the running game.
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';

describe('no monolith', () => {
  it('has no JavaScript at the repo root apart from the vitest config', () => {
    const rootJs = readdirSync('.').filter(f => /\.(js|mjs|cjs)$/.test(f));
    expect(rootJs).toEqual(['vitest.config.js']);
  });
  it('index.html loads only src/main.js', () => {
    const scripts = [...readFileSync('index.html', 'utf8').matchAll(/<script[^>]*src="([^"]+)"/g)].map(m => m[1]);
    expect(scripts).toEqual(['src/main.js']);
  });
});
