// ── UI: Log ───────────────────────────────────────────
// Adds entries to state.log. Pure side-effect (state mutation).

const LOG_ICONS = { good: '✅', bad: '❌', neutral: '📋', special: '⭐' };

export function addLog(state, msg, type = 'neutral') {
  state.log.unshift({ msg, type, icon: LOG_ICONS[type] ?? '📋' });
  if (state.log.length > 40) state.log.pop();
}
