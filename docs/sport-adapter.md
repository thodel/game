# SportAdapter Interface

The SportAdapter is the seam between the career engine (`src/core/`) and sport-specific logic (`src/sports/`). The career engine **never** checks `state.sport` directly — all sport behaviour routes through the adapter.

## Interface Contract

```js
{
  id: string,               // 'football' | 'basketball'
  name: string,             // display name, e.g. 'Fussball'
  icon: string,             // emoji, e.g. '⚽'
  color: string,            // CSS class suffix, e.g. 'football'
  positions: string[],      // ['Torwart', 'Abwehr', ...]
  stats: string[],          // ['Tempo', 'Technik', ...]
  leagues: string[],        // ['Kreisliga', ...] or ['G-League', 'NBA']
  startLeagueIndex: number, // index into leagues where player starts
  matchEvents: {
    player: string[],
    opponent: string[],
    neutral: string[],
  },
  // For basketball only — per-league team lists
  teamsByLeague?: string[][],

  // Fallback / compat
  teamNames: string[],

  // Core adapter methods
  createMatch(state): MatchContext
  simulateHeadless(state, ctx): MatchResult
  scoreLabel: string   // 'Tore' for football, 'Punkte' for basketball
  boxScoreFields: { key: string, label: string }[]
}
```

## Methods

### `createMatch(state) → MatchContext`
Returns a `{ opponent, seed }` object. Used by the live (interactive) match engine to pick an opponent and initialise RNG state.

### `simulateHeadless(state, ctx) → MatchResult`
Runs a complete match simulation using the career state and a match context. Returns:

```js
{
  playerGoals,   // goals/points scored personally by the player
  oppGoals,      // opponent score
  result: 'win' | 'draw' | 'loss',
  opponent: string,
  events: { text, minute, type }[],
  money: number, // earnings from this match
  personal: number, // personal contribution (goals or points)
  assists: number,
  score: string, // e.g. '3 : 1' or '95 : 87'
}
```

The method is responsible for:
- Reading player skill/energy/morale from state
- Computing opponent strength based on leagueIndex
- Updating `state.career` (wins/losses/goals/etc.)
- Advancing `state.career.week`; calling `endSeason()` when the season ends
- Deducting energy, updating morale/fame/money
- Checking achievements

## Registry

Adapters are registered in `src/sports/adapters.js`:

```js
export const adapters = [footballAdapter, basketballAdapter];
export function getAdapter(id) { ... }
```

The title screen iterates the registry to build sport-selection buttons — no hardcoded sport checks.

## Adding a Third Sport

1. Implement a new adapter in `src/sports/<name>/index.js`
2. Import and push it into the registry
3. Add teams/stats/positions/leagues to the adapter

No edits to `src/core/` or `src/ui/` are required.
