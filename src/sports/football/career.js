// ── Football career hooks ─────────────────────────────
// The app shell never asks which sport it is; it calls these.
import { createRNG }  from '../../core/rng.js';
import { saveGame }   from '../../core/persistence.js';
import { addLog }     from '../../ui/log.js';
import { footballAdapter } from './index.js';

export const careerHooks = {
  // The live 11-a-side match lives in the shell (canvas, stadium intro)
  playMatch(state, App) { App.showFootballMatch(); },

  // A football career runs week by week: any action spends the week
  spendDay(state, App) {
    const c = state.career;
    c.week++;
    if (c.week > c.weeksPerSeason) App.endSeason();
    return true;
  },

  simSeason(state, App) {
    const c = state.career;
    const results = [];
    for (let w = c.week; w <= c.weeksPerSeason; w++) {
      const matchCtx = footballAdapter.createMatch(state);
      const rng = createRNG(matchCtx.seed);
      results.push(footballAdapter.simulateHeadless(state, { rng, ...matchCtx }));
    }
    results.forEach(r => addLog(state, `${r.opponent}: ${r.score}`, r.result === 'win' ? 'good' : r.result === 'loss' ? 'bad' : 'neutral'));
    if (c.week > c.weeksPerSeason) App.endSeason();
    saveGame(state);
    App.showHub();
  },

  hubSection() { return ''; },
  matchScreen() { return null; },
};
