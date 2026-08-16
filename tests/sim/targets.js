// Target bands for the basketball engine, taken from NBA per-team per-game
// averages (2023-24 regular season, basketball-reference league averages).
//
// The bands are wide for two reasons. The engine genuinely sits below the real
// league on several rates — shooting is a couple of points low, offensive
// rebounding runs ~19% against a real 26% because box-outs are not modelled —
// and over the sample these tests can afford, each rate still moves a point or
// two run to run. The bands are here to catch a model that has broken, not to
// pin the engine to one season. Tighten them only if you are ready to retune
// when they fail. Remaining gaps are tracked in #59.
export const TARGETS = {
  'FG%':       { real: 47.5, min: 41, max: 51 },   // engine runs 42.5-45.5
  '3P%':       { real: 36.6, min: 27, max: 42 },   // engine runs 29.7-35.7 sample to sample   // engine shoots ~33; raising it swings
                                                   // the shot mix to 57% threes, so the gap stays
  'FT%':       { real: 78.3, min: 73, max: 84 },
  '3PA share': { real: 42.0, min: 20, max: 48 },   // engine still runs low; see #58
  'OREB%':     { real: 26.0, min: 15, max: 30 },   // engine runs ~19: box-outs are not modelled
  'PTS':       { real: 114.2, min: 100, max: 130 },
  'FGA':       { real: 88.5, min: 80, max: 115 },  // pace runs fast; see #58
  'FTA':       { real: 21.8, min: 12, max: 28 },
  'REB':       { real: 43.6, min: 38, max: 58 },
  'AST':       { real: 26.7, min: 17, max: 36 },   // engine runs 18-22
  'TOV':       { real: 13.5, min: 8, max: 18 },
  'STL':       { real: 7.5, min: 5, max: 11 },
  'BLK':       { real: 5.0, min: 2, max: 8 },
  'PF':        { real: 19.4, min: 12, max: 24 },
  _maxPlayerFga: 45,   // no single player should monopolise a team's shots
};

export function evaluate(measured) {
  return Object.entries(measured).map(([name, value]) => {
    const t = TARGETS[name];
    return {
      name, value,
      band: t ? `${t.min}-${t.max} (real ${t.real})` : '-',
      ok: !t || (value >= t.min && value <= t.max),
    };
  });
}

export const formatRow = (a, b, c, d) =>
  `${String(a).padEnd(12)}${String(b).padStart(9)}  ${String(c).padEnd(22)}${d}`;

