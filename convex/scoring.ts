type CriteriaEntry = {
  level: number;
  metric: string;
  value: number;
  unit: string;
};

export function findCriteriaForLevel(
  criteriaPerLevel: CriteriaEntry[],
  level: number
): CriteriaEntry {
  const exact = criteriaPerLevel.find((c) => c.level === level);
  if (exact) return exact;
  const levelOne = criteriaPerLevel.find((c) => c.level === 1);
  if (levelOne) return levelOne;
  // Fall back to the lowest defined level instead of crashing on a non-null
  // assertion when neither the user's level nor level 1 exists.
  const sorted = [...criteriaPerLevel].sort((a, b) => a.level - b.level);
  return sorted[0] ?? { level, metric: "", value: 0, unit: "" };
}

export function calculateCoinsEarned(
  metricsValue: number,
  criteriaValue: number,
  multiplier: number
): number {
  // Guard against invalid inputs (0/negative criteria → division by zero →
  // Infinity/NaN, which would permanently corrupt lifetime coin totals and
  // every downstream aggregate). Only well-formed positive inputs mint coins.
  if (!Number.isFinite(metricsValue) || metricsValue <= 0) return 0;
  if (!Number.isFinite(criteriaValue) || criteriaValue <= 0) return 0;
  if (!Number.isFinite(multiplier) || multiplier < 0) return 0;
  const coins = (metricsValue / criteriaValue) * multiplier;
  return Number.isFinite(coins) && coins > 0 ? coins : 0;
}

// Applies a delta to a coin total, flooring at 0 (revoke can never produce negative coins).
export function applyCoinDelta(currentCoins: number, delta: number): number {
  return Math.max(0, currentCoins + delta);
}
