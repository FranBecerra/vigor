import { shortSessionDisposition } from '../generatorDisposition';

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
