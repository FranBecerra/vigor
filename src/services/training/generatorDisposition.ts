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

/** Audit denominators count simulations (including probes), never athletes. */
export function summarizeSessionDispositions(reports: readonly {
  input: { goal: string };
  expectedInfeasible: boolean;
  quality?: { sessions: readonly { sets: number }[] };
}[]) {
  const hypertrophy = reports.filter((report) => report.input.goal === 'HYPERTROPHY');
  const evaluable = hypertrophy.filter((report) => !report.expectedInfeasible && report.quality);
  const dispositions = evaluable.map((report) => shortSessionDisposition(report.quality!.sessions.map((session) => session.sets)));
  return {
    totalCases: reports.length,
    hypertrophyCases: hypertrophy.length,
    evaluableHypertrophyCases: evaluable.length,
    expectedInfeasibleHypertrophyCases: hypertrophy.filter((report) => report.expectedInfeasible).length,
    missingQualityHypertrophyCases: hypertrophy.filter((report) => !report.expectedInfeasible && !report.quality).length,
    shortCases: dispositions.filter((disposition) => disposition.shortSessionIndexes.length > 0).length,
    shortSessions: dispositions.reduce((sum, disposition) => sum + disposition.shortSessionIndexes.length, 0),
    insufficientDoseCases: dispositions.filter((disposition) => disposition.category === 'insufficient-total-dose-for-requested-frequency').length,
    allocationBottleneckCases: dispositions.filter((disposition) => disposition.category === 'allocation-bottleneck-needs-local-repair').length,
  };
}
