// ── Season rollover ───────────────────────────────────
const PROMOTION_RATE   = 0.55; // win rate ≥ this  → promote
const RELEGATION_RATE  = 0.30; // win rate  < this → relegate (at bottom only)

export function endSeason(career, leagueCount) {
  const total = career.wins + career.losses + career.draws;

  // No games played — still counts as a season, no promotion/relegation
  if (total === 0) {
    career.seasons++;
    career.week = 1;
    career.wins = career.losses = career.draws = 0;
    return { promoted: false, relegated: false };
  }

  const winRate = career.wins / total;
  const maxIdx  = leagueCount - 1;
  let promoted  = false;
  let relegated = false;

  if (winRate >= PROMOTION_RATE && career.leagueIndex < maxIdx) {
    career.leagueIndex++;
    career.promotions++;
    promoted = true;
  } else if (winRate < RELEGATION_RATE && career.leagueIndex > 0) {
    // Only relegate if there's actually a lower league to fall into
    career.leagueIndex--;
    career.relegations++;
    relegated = true;
  }

  career.seasons++;
  career.week = 1;
  career.wins = career.losses = career.draws = 0;

  return { promoted, relegated };
}
