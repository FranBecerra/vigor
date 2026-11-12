import { upcomingSportActivities, saveSportDraft } from '../sportActivities';
const now = Date.parse('2026-11-02T12:00Z');
const make = (id: string, startAt = now) => saveSportDraft(id, 'owner', { sport: 'PADEL', context: 'CLASS', name: '', notes: '',
  mode: 'PLAN', startAt, durationMinutes: 60, timeZone: 'UTC', effort: null }, now);
it('keeps in-progress/future appointments ordered and excludes expired, completed or cancelled work', () => {
  const a = make('a'), b = make('b'), future = make('future', now + 86400000), later = make('later', now + 2 * 86400000);
  const entries = [later, future, b, a, make('expired', now - 3600000),
    { ...make('cancelled'), discardedAt: now }, { ...make('record'), record: { source: 'MANUAL' as const, feedback: null, startAt: now, durationMinutes: 60, timeZone: 'UTC' } }];
  const before = JSON.stringify(entries);
  expect(upcomingSportActivities(entries, now).map((e) => e.id)).toEqual(['a', 'b', 'future']);
  expect(upcomingSportActivities(entries, now, 1).map((e) => e.id)).toEqual(['a']);
  expect(upcomingSportActivities(entries, now + 3600000).map((e) => e.id)).toEqual(['future', 'later']);
  expect(JSON.stringify(entries)).toBe(before);
});
it.each([0, -1, 53, NaN, 1.5])('handles invalid bounds without inventing upcoming work: %s', (limit) => {
  expect(upcomingSportActivities([make('a')], now, limit)).toEqual([]);
});
it('handles empty or unavailable dates', () => {
  expect(upcomingSportActivities([], now)).toEqual([]);
  expect(upcomingSportActivities([make('a')], NaN)).toEqual([]);
});
