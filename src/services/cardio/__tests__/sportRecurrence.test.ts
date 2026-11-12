import { previewSportRecurrence, sportLocalDate, sportLocalWeekday, validSportRepeatRule } from '../sportRecurrence';
import type { SportRepeatRule } from '@/models/sportActivity';

const anchor = Date.parse('2026-10-27T18:30:00Z'); // Tuesday 19:30 in Madrid.
const weekly: SportRepeatRule = { frequency: 'WEEKLY', interval: 1, weekdays: [2, 4], untilDate: '2026-11-12' };
const iso = (values: number[]) => values.map((v) => new Date(v).toISOString());

it('expands multiple weekdays in calendar order, inclusive of the last date, without mutating the rule', () => {
  const before = JSON.stringify(weekly);
  expect(iso(previewSportRecurrence(anchor, 'Europe/Madrid', weekly).starts)).toEqual([
    '2026-10-27T18:30:00.000Z', '2026-10-29T18:30:00.000Z', '2026-11-03T18:30:00.000Z',
    '2026-11-05T18:30:00.000Z', '2026-11-10T18:30:00.000Z', '2026-11-12T18:30:00.000Z',
  ]);
  expect(JSON.stringify(weekly)).toBe(before);
  expect(sportLocalDate(anchor, 'Pacific/Kiritimati')).toBe('2026-10-28');
  expect(sportLocalWeekday(anchor, 'Europe/Madrid')).toBe(2);
});
it('anchors every N weeks to the first Monday-based calendar week, excluding earlier dates', () => {
  expect(previewSportRecurrence(anchor, 'UTC', { ...weekly, interval: 2 }).starts.map((v) => sportLocalDate(v, 'UTC')))
    .toEqual(['2026-10-27', '2026-10-29', '2026-11-10', '2026-11-12']);
  expect(previewSportRecurrence(Date.parse('2026-11-01T12:00Z'), 'UTC',
    { ...weekly, weekdays: [0, 1], interval: 2, untilDate: '2026-11-15' }).starts.map((v) => sportLocalDate(v, 'UTC')))
    .toEqual(['2026-11-01', '2026-11-09', '2026-11-15']);
});
it('keeps local class time over spring and autumn DST rather than adding 168 elapsed hours', () => {
  const result = previewSportRecurrence(Date.parse('2026-03-22T17:30Z'), 'Europe/Madrid',
    { ...weekly, weekdays: [0], untilDate: '2026-04-05' });
  expect(iso(result.starts)).toEqual(['2026-03-22T17:30:00.000Z', '2026-03-29T16:30:00.000Z', '2026-04-05T16:30:00.000Z']);
  expect(iso(previewSportRecurrence(Date.parse('2026-10-18T16:30Z'), 'Europe/Madrid',
    { ...weekly, weekdays: [0], untilDate: '2026-11-01' }).starts)).toEqual([
    '2026-10-18T16:30:00.000Z', '2026-10-25T17:30:00.000Z', '2026-11-01T17:30:00.000Z',
  ]);
});
it('omits nonexistent local times and chooses the earlier repeated hour without changing a chosen anchor', () => {
  const gap = previewSportRecurrence(Date.parse('2026-03-22T01:30Z'), 'Europe/Madrid',
    { ...weekly, weekdays: [0], untilDate: '2026-04-05' });
  expect(gap.skippedDates).toEqual(['2026-03-29']); expect(gap.starts).toHaveLength(2);
  const fold = previewSportRecurrence(Date.parse('2026-10-18T00:30Z'), 'Europe/Madrid',
    { ...weekly, weekdays: [0], untilDate: '2026-11-01' });
  expect(iso(fold.starts)[1]).toBe('2026-10-25T00:30:00.000Z');
  const chosenLater = Date.parse('2026-10-25T01:30:00.123Z');
  expect(previewSportRecurrence(chosenLater, 'Europe/Madrid',
    { ...weekly, weekdays: [0], untilDate: '2026-11-01' }).starts[0]).toBe(chosenLater);
});
it('handles half-hour DST zones and preserves milliseconds', () => {
  const result = previewSportRecurrence(Date.parse('2026-09-26T22:00:00.321Z'), 'Australia/Lord_Howe',
    { ...weekly, weekdays: [0], untilDate: '2026-10-11' });
  expect(iso(result.starts)).toEqual(['2026-09-26T22:00:00.321Z', '2026-10-03T21:30:00.321Z', '2026-10-10T21:30:00.321Z']);
});
it('anchors monthly dates without rollover or end-of-month drift, including leap years and N months', () => {
  const rule: SportRepeatRule = { frequency: 'MONTHLY', interval: 1, untilDate: '2027-07-31' };
  expect(previewSportRecurrence(Date.parse('2027-01-31T12:00Z'), 'UTC', rule).starts.map((v) => sportLocalDate(v, 'UTC')))
    .toEqual(['2027-01-31', '2027-03-31', '2027-05-31', '2027-07-31']);
  expect(previewSportRecurrence(Date.parse('2028-01-29T12:00Z'), 'UTC', { ...rule, untilDate: '2028-03-29' }).starts)
    .toHaveLength(3);
  expect(previewSportRecurrence(Date.parse('2027-11-15T12:00Z'), 'UTC', { ...rule, interval: 2, untilDate: '2028-03-15' }).starts
    .map((v) => sportLocalDate(v, 'UTC'))).toEqual(['2027-11-15', '2028-01-15', '2028-03-15']);
});
it.each([null, [], {}, { ...weekly, interval: 0 }, { ...weekly, interval: 13 }, { ...weekly, interval: 1.5 },
  { ...weekly, frequency: 'DAILY' }, { ...weekly, weekdays: [] }, { ...weekly, weekdays: [1, 1] },
  { ...weekly, weekdays: [7] }, { ...weekly, weekdays: [1.5] }, { ...weekly, weekdays: 'Monday' },
  { ...weekly, untilDate: '2026-02-30' }, { ...weekly, untilDate: null }, { ...weekly, extra: true },
  { frequency: 'MONTHLY', interval: 1, untilDate: '2026-12-31', weekdays: [1] },
])('rejects malformed or ambiguous rules: %j', (rule) => {
  expect(validSportRepeatRule(rule)).toBe(false);
  expect(() => previewSportRecurrence(anchor, 'UTC', rule as any)).toThrow('invalidSportRecurrence');
});
it('bounds horizons, occurrence count and minimum useful series size', () => {
  for (const untilDate of ['2026-10-26', '2026-10-27', '2028-01-01']) {
    expect(() => previewSportRecurrence(anchor, 'UTC', { ...weekly, untilDate })).toThrow('invalidSportRecurrence');
  }
  expect(() => previewSportRecurrence(anchor, 'UTC', { ...weekly, weekdays: [2], untilDate: '2026-10-28' })).toThrow();
  expect(() => previewSportRecurrence(anchor, 'UTC', { ...weekly, weekdays: [0, 1, 2, 3, 4, 5, 6], untilDate: '2027-01-01' })).toThrow('sportRecurrenceTooLarge');
  expect(previewSportRecurrence(anchor, 'UTC', { ...weekly, weekdays: [2], untilDate: '2027-10-19' }).starts).toHaveLength(52);
  expect(previewSportRecurrence(anchor, 'UTC', { frequency: 'MONTHLY', interval: 12, untilDate: '2027-10-27' }).starts).toHaveLength(2);
});
it.each([NaN, Infinity, 0, -1, 8.64e15, 1.5])('rejects invalid epochs: %s', (epoch) => {
  expect(() => previewSportRecurrence(epoch, 'UTC', weekly)).toThrow();
  expect(() => sportLocalDate(epoch, 'UTC')).toThrow();
});
it('rejects invalid zones consistently in the preview and date helpers', () => {
  for (const zone of ['Not/AZone', '', 'x'.repeat(101), null, undefined]) {
    expect(() => previewSportRecurrence(anchor, zone as any, weekly)).toThrow('invalidSportRecurrence');
    expect(() => sportLocalDate(anchor, zone as any)).toThrow('invalidSportRecurrence');
  }
});
