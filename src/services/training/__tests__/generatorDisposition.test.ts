import { shortSessionDisposition, summarizeSessionDispositions } from '../generatorDisposition';

it('distinguishes a redistribution problem from an insufficient total without adding filler', () => {
  expect(shortSessionDisposition([9, 15, 12])).toMatchObject({
    category: 'allocation-bottleneck-needs-local-repair', missingSetsForFloor: 0, shortSessionIndexes: [0] });
  expect(shortSessionDisposition([9, 10, 12, 10, 9])).toMatchObject({
    category: 'insufficient-total-dose-for-requested-frequency', missingSetsForFloor: 10, doseOnlyMaximumSessions: 4 });
  expect(shortSessionDisposition([12, 12])).toMatchObject({ category: 'no-short-session' });
  expect(shortSessionDisposition([])).toMatchObject({ category: 'no-short-session', totalSets: 0 });
  expect(shortSessionDisposition([0, 0])).toMatchObject({ shortSessionIndexes: [0, 1], missingSetsForFloor: 24 });
});
it.each([[[NaN]], [[-1]], [[1.5]], [[Infinity]]])('rejects malformed session doses (%s)', (sets) => {
  expect(() => shortSessionDisposition(sets)).toThrow(RangeError);
});
it.each([0, -1, NaN, Infinity])('rejects malformed floors (%s)', (floor) => {
  expect(() => shortSessionDisposition([12], floor)).toThrow(RangeError);
});

it('counts probes as separate cases and separates controls, missing quality, goals and sessions', () => {
  const report = (sets: number[], goal = 'HYPERTROPHY', expectedInfeasible = false) => ({
    input: { goal }, expectedInfeasible, quality: { sessions: sets.map((sets) => ({ sets })) },
  });
  expect(summarizeSessionDispositions([
    report([11, 13]), report([11, 13]), report([6, 9, 11]), report([12, 12]),
    report([0, 0], 'HYPERTROPHY', true), report([6, 9], 'STRENGTH'),
    { input: { goal: 'HYPERTROPHY' }, expectedInfeasible: false },
  ])).toEqual({ totalCases: 7, hypertrophyCases: 6, evaluableHypertrophyCases: 4,
    expectedInfeasibleHypertrophyCases: 1, missingQualityHypertrophyCases: 1,
    shortCases: 3, shortSessions: 5, insufficientDoseCases: 1, allocationBottleneckCases: 2 });
});
it('handles an empty audit and propagates invalid recorded doses rather than hiding them', () => {
  expect(summarizeSessionDispositions([])).toMatchObject({ totalCases: 0, shortCases: 0, shortSessions: 0 });
  expect(() => summarizeSessionDispositions([{ input: { goal: 'HYPERTROPHY' }, expectedInfeasible: false,
    quality: { sessions: [{ sets: NaN }] } }])).toThrow(RangeError);
});
