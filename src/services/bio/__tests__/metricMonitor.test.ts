import type { BioHealthDay, BioHealthTrend } from '@/models/bioHealth';
import { localCheckInDate } from '../dailyCheckIn';
import { buildMetricMonitor, metricChartSlots, metricCoordinate, metricDomain } from '../metricMonitor';

const now = new Date(2026, 9, 28, 10).getTime();
const day = (ago: number, value = 50): BioHealthDay => {
  const at = new Date(now); at.setDate(at.getDate() - ago);
  return { date: localCheckInDate(at.getTime()), value, at: at.getTime(), samples: 1 };
};
const trend = (patch: Partial<BioHealthTrend> = {}): BioHealthTrend => ({ metric: 'RESTING_HR', status: 'AVAILABLE',
  sourceId: 'watch', sourceName: 'Watch', fresh: true, latest: day(0), days: Array.from({ length: 29 }, (_, index) => day(index, index ? 40 + index : 50)), ...patch });
it('uses the preceding 28 days, excludes the current reading and interpolates P10–P90', () => {
  const input = trend({ latest: day(0, 500) }), before = JSON.stringify(input);
  const view = buildMetricMonitor(input, undefined, now);
  expect(view.range).toEqual({ lower: 43.7, upper: 65.3, count: 28, from: day(28).date, to: day(1).date });
  expect(view.position).toBe('ABOVE');expect(JSON.stringify(input)).toBe(before);
  expect(buildMetricMonitor(trend({ days: [...input.days, day(29, 999)] }), undefined, now).range).toEqual(view.range);
});
it.each(['ERROR', 'TRUNCATED', 'EMPTY'] as const)('keeps %s data unqualified even if values are supplied', (status) => {
  const view = buildMetricMonitor(trend({ status }), 480, now);
  expect(view).toEqual({ days: [], position: status === 'EMPTY' ? 'MISSING' : 'ERROR' });
});
it.each([{}, { sourceId: '' }, { latest: undefined }, { latest: day(0, 0) }, { latest: day(0, NaN) },
  { latest: { ...day(0), at: Infinity } }, { latest: { ...day(0), at: now + 1 } }, { latest: { ...day(0), date: '2026-02-30' } },
  { latest: { ...day(0), date: 'invalid' } }])('rejects invalid or uncomparable data %j', (patch) => {
  const input = Object.keys(patch).length ? trend(patch) : trend();
  const view = buildMetricMonitor(input, undefined, Object.keys(patch).length ? now : NaN);
  expect(view.position).toBe('MISSING'); expect(view.latest).toBeUndefined();
});
it('requires 14 distinct prior dates, ignores invalid days, selects newest duplicates, and keeps constant bounds real', () => {
  const days = Array.from({ length: 14 }, (_, index) => day(index + 1));
  expect(buildMetricMonitor(trend({ days: days.slice(1) }), undefined, now).position).toBe('BUILDING');
  const invalid = [{ ...day(1), date: 'bad' }, day(2, -1), { ...day(3), at: Infinity }, { ...day(4), at: now + 1 }, day(-1)];
  const input = trend({ days: [...days, ...invalid, { ...day(1, 1), at: day(1).at - 1 }, day(1), { ...day(2), at: day(2).at + 1 }] });
  expect(buildMetricMonitor(input, undefined, now)).toMatchObject({ position: 'WITHIN', range: { lower: 50, upper: 50, count: 14 } });
  expect(buildMetricMonitor(trend({ days, latest: day(0, 49) }), undefined, now).position).toBe('BELOW');
  expect(buildMetricMonitor(trend({ days, latest: day(0, 51) }), undefined, now).position).toBe('ABOVE');
});
it('keeps unusual high HRV and low pulse descriptive, not automatically favorable', () => {
  expect(buildMetricMonitor(trend({ metric: 'HRV_SDNN', latest: day(0, 300) }), undefined, now).position).toBe('ABOVE');
  expect(buildMetricMonitor(trend({ latest: day(0, 10) }), undefined, now).position).toBe('BELOW');
});
it('keeps an older reading visible but neutral, even with an established range', () => {
  expect(buildMetricMonitor(trend({ fresh: false }), undefined, now)).toMatchObject({ position: 'STALE', latest: day(0) });
  expect(buildMetricMonitor(trend({ latest: day(2) }), undefined, now).position).toBe('STALE');
  expect(buildMetricMonitor(trend(), undefined, now + 36 * 3600000).position).not.toBe('STALE');
});
it('compares sleep with the selected target, never equating habitual duration with adequate sleep', () => {
  const input = trend({ metric: 'SLEEP', latest: day(0, 450), days: Array.from({ length: 20 }, (_, index) => day(index + 1, 450)) });
  expect(buildMetricMonitor(input, 495, now)).toMatchObject({ position: 'TARGET_BELOW', range: { lower: 450, upper: 450 }, goal: 495 });
  expect(buildMetricMonitor(input, 450, now).position).toBe('TARGET_MET');
  expect(buildMetricMonitor(input, undefined, now).position).toBe('GOAL_MISSING');
  expect(buildMetricMonitor(input, 99, now).goal).toBeUndefined();
  expect(buildMetricMonitor({ ...input, days: [] }, 495, now)).toMatchObject({ position: 'TARGET_BELOW', range: undefined });
});
it('uses calendar slots across DST and does not fill or connect missing days', () => {
  const view = buildMetricMonitor(trend({ days: [day(0), day(2), day(13), day(15)] }), undefined, now);
  const slots = metricChartSlots(view);
  expect(slots).toHaveLength(14); expect(slots[0].date).toBe(day(13).date);expect(slots[13].date).toBe(day(0).date);
  expect(slots.filter((slot) => slot.day)).toHaveLength(3); expect(slots[12].day).toBeUndefined();
  expect(metricChartSlots({ days: [], position: 'MISSING' })).toEqual([]);
});
it('derives a finite padded domain and maps both ordinary and extreme readings without clipping', () => {
  expect(metricDomain([])).toBeUndefined(); expect(metricDomain([NaN, Infinity, 0, -1])).toBeUndefined();
  const domain = metricDomain([50, 50, 50])!;expect(domain.lower).toBeLessThan(50);expect(domain.upper).toBeGreaterThan(50);
  expect(metricCoordinate(50, domain)).toBe(.5);expect(metricCoordinate(0, domain)).toBe(0);expect(metricCoordinate(999, domain)).toBe(1);
  expect(metricDomain([1, 100])).toEqual({ lower: -23.75, upper: 124.75 });
  expect(metricDomain([1])).toEqual({ lower: .5, upper: 1.5 });
});
