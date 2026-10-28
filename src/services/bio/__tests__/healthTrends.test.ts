import { BIO_HEALTH_METRICS, type BioHealthRead, type BioHealthSample } from '@/models/bioHealth';
import { buildHealthTrends, healthChartDays, healthWindowStart, median } from '../healthTrends';
const now = new Date(2026, 9, 26, 10).getTime();
const empty = (): BioHealthRead => ({ SLEEP: { samples: [], error: false, truncated: false }, RESTING_HR: { samples: [], error: false, truncated: false }, HRV_SDNN: { samples: [], error: false, truncated: false } });
const sample = (patch: Partial<BioHealthSample> = {}): BioHealthSample => ({ id: 'sample', metric: 'HRV_SDNN',
  start: now - 3600000, end: now - 3500000, value: 40, sourceId: 'watch', sourceName: 'Watch', manuallyEntered: false, ...patch });
function build(samples: BioHealthSample[], metric: BioHealthSample['metric'] = 'HRV_SDNN') {
  const input = empty(); input[metric].samples = samples; return buildHealthTrends(input, now).find((trend) => trend.metric === metric)!;
}
it('leaves absent, errored and capped results unknown instead of zero or authorized', () => {
  expect(buildHealthTrends(empty(), now).every((trend) => trend.status === 'EMPTY' && trend.latest === undefined)).toBe(true);
  const input = empty(); input.SLEEP.error = true; input.HRV_SDNN.truncated = true;
  expect(buildHealthTrends(input, now).map((trend) => trend.status)).toEqual(['ERROR', 'EMPTY', 'TRUNCATED']);
  expect(buildHealthTrends(undefined as any, now).map((trend) => trend.status)).toEqual(['EMPTY', 'EMPTY', 'EMPTY']);
  expect(buildHealthTrends(input, NaN)).toEqual([]); expect(buildHealthTrends(input, 9e20)).toEqual([]);
  expect(healthChartDays(build([]))).toEqual([]);
});
it.each([
  { id: '' }, { sourceId: '' }, { sourceName: '' }, { sourceId: 'x'.repeat(501) }, { sourceName: 'x'.repeat(301) },
  { manuallyEntered: true }, { manuallyEntered: undefined }, { start: NaN }, { start: -1 }, { end: Infinity },
  { end: now + 1 }, { end: now - 4000000 }, { value: NaN }, { value: 0 }, { value: -1 }, { value: 2001 }, { metric: 'SLEEP' },
])('rejects invalid/unreviewed observation %j', (patch) => {
  expect(build([sample(patch as any)]).status).toBe('EMPTY');
});
it('deduplicates identity, uses daily medians and excludes the current day from its reference', () => {
  const history = Array.from({ length: 16 }, (_, index) => {
    const day = new Date(now); day.setDate(day.getDate() - index);
    return sample({ id: `day${index}`, start: day.getTime() - 3600000, end: day.getTime(), value: index === 0 ? 90 : 40 });
  });
  const trend = build([...history, history[1], sample({ id: 'another', value: 30 })]);
  expect(trend.latest!.value).toBe(60); expect(trend.days).toHaveLength(16);
  expect(trend.reference).toMatchObject({ median: 40, days: 15 }); expect(trend.fresh).toBe(true);
  expect(median([1, 10, 2])).toBe(2); expect(median([2, 4])).toBe(3);
  expect(trend.reference!.to).not.toBe(trend.latest!.date);
});
it('does not pool sources, favors a current source and deterministically resolves ties', () => {
  const older = Array.from({ length: 20 }, (_, index) => sample({ id: `old${index}`, sourceId: 'old',
    start: now - (index + 3) * 86400000, end: now - (index + 3) * 86400000 + 1000 }));
  expect(build([...older, sample()]).sourceId).toBe('watch');
  expect(build([...older, sample()]).reference).toBeUndefined();
  expect(build([sample({ id: 'z', sourceId: 'z' }), sample({ id: 'a', sourceId: 'a' })]).sourceId).toBe('a');
  expect(build(older).fresh).toBe(false);
});
it('merges overlapping sleep intervals within one source without counting time awake/in bed', () => {
  const end = new Date(2026, 9, 26, 8).getTime();
  const trend = build([sample({ metric: 'SLEEP', id: 'whole', start: end - 8 * 3600000, end, value: 480 }),
    sample({ metric: 'SLEEP', id: 'core', start: end - 7 * 3600000, end: end - 3600000, value: 360 }),
    sample({ metric: 'SLEEP', id: 'extra', start: end - 10 * 3600000, end: end - 9 * 3600000, value: 60 })], 'SLEEP');
  expect(trend.latest).toMatchObject({ date: '2026-10-26', value: 540 });
  expect(build([sample({ metric: 'SLEEP', start: now - 25 * 3600000 })], 'SLEEP').status).toBe('EMPTY');
});
it('splits sleep at calendar noon, retains gaps, bounds references and rejects future reporting nights', () => {
  const start = new Date(2026, 9, 24, 11).getTime(), end = new Date(2026, 9, 24, 14).getTime();
  const trend = build([sample({ metric: 'SLEEP', start, end, value: 180 })], 'SLEEP');
  expect(trend.days.map((day) => [day.date, day.value])).toEqual([['2026-10-24', 60], ['2026-10-25', 120]]);
  const padded = healthChartDays(trend); expect(padded).toHaveLength(14); expect(padded.filter((day) => day.day)).toHaveLength(2);
  expect(padded.at(-1)!.date).toBe('2026-10-25');
  const input = empty(); input.SLEEP.samples = [sample({ metric: 'SLEEP', start, end, value: 180 })];
  expect(buildHealthTrends(input, end).find((item) => item.metric === 'SLEEP')!.days).toHaveLength(1);
  const history = Array.from({ length: 40 }, (_, index) => sample({ id: String(index), start: now - index * 86400000 - 1000,
    end: now - index * 86400000, value: index > 28 ? 1000 : 40 }));
  expect(build(history).reference).toMatchObject({ median: 40, days: 28 });
  expect(healthWindowStart(now)).toBeLessThan(now - 41 * 86400000);
});
it('enforces the quantity-specific units/range and preserves a source change as a new reference', () => {
  expect(build([sample({ metric: 'RESTING_HR', value: 301 })], 'RESTING_HR').status).toBe('EMPTY');
  expect(build([sample({ metric: 'RESTING_HR', value: 55 })], 'RESTING_HR').latest!.value).toBe(55);
  expect(build([sample({ id: 'old', start: healthWindowStart(now) - 1, end: now - 1 })]).status).toBe('EMPTY');
});
