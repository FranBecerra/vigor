import type { SportActivityDraft } from '@/models/sportActivity';
import { createSportActivitySeries, sportDocumentEntries, validSportActivitySeries } from '../sportActivitySeries';
import { discardSportActivity, saveSportDraft, sportDraft, validSportActivity } from '../sportActivities';

const now = Date.parse('2026-10-27T08:00Z');
const draft: SportActivityDraft = { sport: 'PADEL', context: 'CLASS', name: 'Padel class', notes: '', mode: 'PLAN',
  startAt: now + 3600000, durationMinutes: 60, timeZone: 'Europe/Madrid', effort: null,
  repeat: { frequency: 'WEEKLY', interval: 1, weekdays: [2], untilDate: '2026-11-10' } };
const make = () => createSportActivitySeries('series', 'owner', draft, now);

it('creates a finite atomic aggregate with stable independent occurrences, never actual exposure', () => {
  const original = JSON.stringify(draft), series = make();
  expect(validSportActivitySeries(series, 'owner')).toBe(true);
  const entries = sportDocumentEntries(series, 'owner')!;
  expect(entries.map((e) => e.id)).toEqual(['series~0', 'series~1', 'series~2']);
  expect(entries.every((e) => e.record === null && validSportActivity(e, 'owner'))).toBe(true);
  expect(JSON.stringify(draft)).toBe(original);
  series.rule.weekdays!.push(3); expect(JSON.stringify(draft)).toBe(original);
});
it('retains occurrence identity through a single-date correction, recording and recoverable cancellation', () => {
  const series = make(), first = series.occurrences['0'];
  const edit = saveSportDraft(first.id, 'owner', { ...sportDraft(first, 'PLAN', now, 'UTC'), startAt: first.planned!.startAt + 86400000 }, now + 1, first);
  expect(edit.occurrence).toEqual(first.occurrence);
  const recorded = saveSportDraft(first.id, 'owner', { ...sportDraft(edit, 'RECORD', now, 'UTC'), effort: 6 }, now + 3 * 86400000, edit);
  expect(recorded.record?.feedback?.effort).toBe(6); expect(recorded.occurrence).toEqual(first.occurrence);
  const cancelled = discardSportActivity(recorded, 'owner', now + 4 * 86400000);
  expect(validSportActivitySeries({ ...series, occurrences: { ...series.occurrences, '0': cancelled } }, 'owner')).toBe(true);
  expect(series.occurrences['1'].record).toBeNull();
  expect(sportDraft(first, 'PLAN', now, 'UTC').repeat).toBeUndefined();
});
it('preserves legacy single entries and rejects unsupported documents or owners', () => {
  const entry = make().occurrences['0'];
  expect(sportDocumentEntries(entry, 'owner')).toEqual([entry]);
  for (const value of [null, {}, [], { ...make(), schemaVersion: 3 }, { ...make(), userId: 'other' }]) {
    expect(sportDocumentEntries(value, 'owner')).toBeNull();
  }
});
it.each([
  { id: '' }, { id: 'x'.repeat(121) }, { timeZone: 'Invalid/Zone' }, { createdAt: NaN }, { createdAt: 0 },
  { rule: {} }, { occurrences: null }, { occurrences: [] }, { occurrences: {} }, { anchorStartAt: 0 },
])('rejects corrupt aggregate metadata: %j', (patch) => {
  expect(validSportActivitySeries({ ...make(), ...patch }, 'owner')).toBe(false);
});
it('rejects missing/extra/foreign/reidentified or rescheduled provenance, without dropping just one row', () => {
  const series = make(), entry = series.occurrences['0'];
  for (const replacement of [undefined, { ...entry, userId: 'other' }, { ...entry, createdAt: now + 1 },
    { ...entry, occurrence: undefined }, { ...entry, occurrence: { ...entry.occurrence!, seriesId: 'other' } },
    { ...entry, occurrence: { ...entry.occurrence!, index: 1 } },
    { ...entry, occurrence: { ...entry.occurrence!, originalStartAt: entry.planned!.startAt + 1 } }]) {
    expect(sportDocumentEntries({ ...series, occurrences: { ...series.occurrences, '0': replacement } }, 'owner')).toBeNull();
  }
  expect(validSportActivitySeries({ ...series, occurrences: { ...series.occurrences, extra: entry } }, 'owner')).toBe(false);
});
it('refuses record-mode series, invalid IDs and accidental recurrence in ordinary single-entry saves', () => {
  for (const changed of [{ ...draft, repeat: undefined }, { ...draft, mode: 'RECORD' as const }]) {
    expect(() => createSportActivitySeries('s', 'owner', changed, now)).toThrow();
  }
  expect(() => createSportActivitySeries('x'.repeat(121), 'owner', draft, now)).toThrow();
  expect(() => createSportActivitySeries('', 'owner', draft, now)).toThrow();
  expect(() => saveSportDraft('s', 'owner', draft, now)).toThrow();
  for (const invalid of [NaN, 0, -1, 1.5, Infinity, 8.64e15 + 1]) {
    expect(() => createSportActivitySeries('s', 'owner', draft, invalid)).toThrow('invalidSportRecurrence');
  }
});
