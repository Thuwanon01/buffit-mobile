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
  return (
    criteriaPerLevel.find((c) => c.level === level) ??
    criteriaPerLevel.find((c) => c.level === 1)!
  );
}

export function calculateCoinsEarned(
  metricsValue: number,
  criteriaValue: number,
  multiplier: number
): number {
  return Math.round((metricsValue / criteriaValue) * multiplier * 10) / 10;
}

// Applies a delta to a coin total, flooring at 0 (revoke can never produce negative coins).
export function applyCoinDelta(currentCoins: number, delta: number): number {
  return Math.max(0, currentCoins + delta);
}
