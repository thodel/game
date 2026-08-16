// ── Sport adapter registry ─────────────────────────────
// All sport-specific behaviour routes through adapters.
// No `sport === '...'` checks outside this directory.

import { footballAdapter    } from './football/index.js';
import { basketballAdapter  } from './basketball/index.js';

export const adapters = [footballAdapter, basketballAdapter];

export function getAdapter(id) {
  return adapters.find(a => a.id === id) ?? null;
}
