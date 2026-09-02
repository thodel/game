// ── Sport adapter registry ─────────────────────────────
// All sport-specific behaviour routes through adapters.
// No `sport === '...'` checks outside this directory.

import { footballAdapter    } from './football/index.js';
import { basketballAdapter  } from './basketball/index.js';
import { careerHooks as footballCareer }   from './football/career.js';
import { careerHooks as basketballCareer } from './basketball/career.js';

footballAdapter.career   = footballCareer;
basketballAdapter.career = basketballCareer;

export const adapters = [footballAdapter, basketballAdapter];

export function getAdapter(id) {
  return adapters.find(a => a.id === id) ?? null;
}
