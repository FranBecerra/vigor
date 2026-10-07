/** Review categories, not a biological dose floor or proof of an optimal repair. */
export function shortSessionDisposition(sets: readonly number[], floor = 12) {
  if (!Number.isFinite(floor) || floor <= 0 || !sets.every((value) => Number.isInteger(value) && value >= 0)) {
    throw new RangeError('Invalid session dose review');
  }
  const totalSets = sets.reduce((sum, count) => sum + count, 0);
  const shortSessionIndexes = sets.flatMap((count, index) => count < floor ? [index] : []);
  const missingSetsForFloor = Math.max(0, sets.length * floor - totalSets);
  return { totalSets, shortSessionIndexes, missingSetsForFloor,
    category: shortSessionIndexes.length === 0 ? 'no-short-session' as const
      : missingSetsForFloor > 0 ? 'insufficient-total-dose-for-requested-frequency' as const
        : 'allocation-bottleneck-needs-local-repair' as const,
    // Whole exercises, time, muscle caps and recovery can make this upper bound unattainable.
    doseOnlyMaximumSessions: Math.floor(totalSets / floor) };
}
