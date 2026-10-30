import { CARDIO_HEALTH_CAP, cardioHealthWindow, reviewCardioHealth } from '../cardioHealthReview';
import type { CardioHealthRead, CardioHealthWorkout } from '@/models/cardioHealth';
const now = Date.UTC(2026, 9, 30, 12), day = 86400000;
const workout = (id = 'a', patch: Partial<CardioHealthWorkout> = {}): CardioHealthWorkout => ({ id, kind: 'RUNNING',
  start: now - day, end: now - day + 3600000, durationSeconds: 1800, sourceId: 'watch', sourceName: 'Watch',
  manuallyEntered: false, ownExport: false, mixedActivities: false, ...patch });
const read = (workouts: CardioHealthWorkout[] = [], patch: Partial<CardioHealthRead> = {}) => ({ version: 1 as const, truncated: false, workouts, ...patch });
it('uses an exact six-week observation window, not a seven-day training microcycle', () => {
  expect(cardioHealthWindow(now)).toEqual({ start: now - 42 * day, end: now });
  for (const value of [0, 1, -1, NaN, Infinity, '1']) expect(() => cardioHealthWindow(value as number)).toThrow('invalidCardioHealthWindow');
});
it.each([null, undefined, {}, { version: 2 }, read([], { truncated: null as any }), { ...read(), workouts: null },
  read(Array.from({ length: CARDIO_HEALTH_CAP + 1 }, () => workout())),
  ...[0, -1, NaN, Infinity, now + 1, '1'].map(earliestAllowedStart => ({ ...read(), earliestAllowedStart })),
])('rejects a malformed native envelope %j', value => expect(() => reviewCardioHealth(value, now)).toThrow('invalidCardioHealthRead'));
it('does not confuse empty, truncated or limited availability with inactivity or current tolerance', () => {
  expect(reviewCardioHealth(read(), now)).toMatchObject({ groups: [], rows: [], canConfirm: false, limited: false });
  expect(reviewCardioHealth(read([workout()], { truncated: true }), now)).toMatchObject({ groups: [], rows: [], truncated: true, canConfirm: false });
  expect(reviewCardioHealth(read([], { earliestAllowedStart: now - 10 * day }), now).limited).toBe(true);
  expect(reviewCardioHealth(read([], { earliestAllowedStart: now - 50 * day }), now).limited).toBe(false);
});
it.each([null, { id: undefined }, { id: '' }, { id: 'x'.repeat(513) }, { kind: 'LIFTING' }, { start: NaN }, { start: now - 43 * day },
  { end: now + 1 }, { end: now - 2 * day }, { durationSeconds: 0 }, { durationSeconds: Infinity }, { durationSeconds: 3602 },
  { distanceMetres: -1 }, { distanceMetres: NaN }, { distanceMetres: 1000001 }, { sourceId: '' }, { sourceName: '' },
  { manuallyEntered: 1 }, { ownExport: null }, { mixedActivities: 'no' }, { externalId: '' },
])('keeps an invalid sample %j out of the summary without silently calling the remainder complete', patch => {
  const sample = patch === null ? null : { ...workout('bad'), ...patch };
  const result = reviewCardioHealth(read([sample as any, workout('good')]), now);
  expect(result.invalidCount).toBe(1); expect(result.countedCount).toBe(1); expect(result.canConfirm).toBe(false);
});
it('separates manual, mixed and own-export records and never imputes missing distance', () => {
  const result = reviewCardioHealth(read([
    workout('own', { ownExport: true }), workout('manual', { manuallyEntered: true }), workout('mixed', { mixedActivities: true }),
    workout('valid', { distanceMetres: 5000 }), workout('bike', { kind: 'CYCLING', start: now - 2 * day, end: now - 2 * day + 3600000 }),
    workout('run2', { start: now - 3 * day, end: now - 3 * day + 3600000, durationSeconds: 3600, distanceMetres: 0 }),
  ]), now);
  expect(result).toMatchObject({ ownCount: 1, manualCount: 1, mixedCount: 1, countedCount: 3, canConfirm: true });
  expect(result.groups).toEqual([
    { kind: 'RUNNING', sessions: 2, minutes: 90, distanceMetres: 5000, distanceSessions: 2, longestMinutes: 60, observedSessionsPerWeek: 2 / 6 },
    { kind: 'CYCLING', sessions: 1, minutes: 30, distanceMetres: null, distanceSessions: 0, longestMinutes: 30, observedSessionsPerWeek: 1 / 6 },
  ]);
});
it('deduplicates stable UUIDs and exact cross-source external identities only', () => {
  const a = workout('a', { externalId: 'external-hash' }), copy = { ...a, id: 'copy', sourceId: 'partner', sourceName: 'Partner' };
  const result = reviewCardioHealth(read([a, a, copy]), now);
  expect(result).toMatchObject({ duplicateCount: 2, countedCount: 1, conflictingCount: 0 });
  expect(result.sources.map(s => s.id)).toEqual(['partner', 'watch']);
  expect(result.rows[0].id).toBe('a');
  const selected = reviewCardioHealth(read([a, copy]), now, 'partner'); expect(selected.rows[0].id).toBe('copy');
  expect(selected.countedCount).toBe(1);
  const ambiguous = reviewCardioHealth(read([a, { ...copy, distanceMetres: 3000 }]), now);
  expect(ambiguous.duplicateCount).toBe(0); expect(ambiguous.overlappingIds).toEqual(['a', 'copy']);
});
it('excludes conflicting UUIDs instead of selecting a revision arbitrarily', () => {
  const conflict = reviewCardioHealth(read([workout(), workout('a', { durationSeconds: 60 }), workout('b', { kind: 'HIIT' })]), now);
  expect(conflict).toMatchObject({ conflictingCount: 1, canConfirm: false, countedCount: 1 });
  expect(conflict.rows.map(w => w.id)).toEqual(['b']);
});
it('requires an explicit source or exclusion to resolve overlaps without modifying source records', () => {
  const rows = [workout('a'), workout('b', { sourceId: 'partner', sourceName: 'Partner' })], original = JSON.stringify(rows);
  expect(reviewCardioHealth(read(rows), now)).toMatchObject({ countedCount: 0, overlappingIds: ['a', 'b'], canConfirm: false });
  expect(reviewCardioHealth(read(rows), now, 'watch')).toMatchObject({ countedCount: 1, canConfirm: true });
  expect(reviewCardioHealth(read(rows), now, undefined, ['b'])).toMatchObject({ countedCount: 1, canConfirm: true });
  expect(reviewCardioHealth(read(rows), now, 'missing')).toMatchObject({ countedCount: 0, canConfirm: false });
  expect(JSON.stringify(rows)).toBe(original);
  const detached = reviewCardioHealth(read(rows), now); detached.rows[0].durationSeconds = 1; expect(rows[0].durationSeconds).toBe(1800);
});
it('does not flag touching consecutive sessions and uses stable source/date ordering', () => {
  const rows = [workout('z'), workout('b', { start: workout().end, end: workout().end + 3600000, sourceId: 'aaa' }),
    workout('c', { start: now - 3 * day, end: now - 3 * day + 3600000, sourceName: 'Another', sourceId: 'other' })];
  const result = reviewCardioHealth(read(rows), now);
  expect(result.overlappingIds).toEqual([]); expect(result.rows.map(r => r.id)).toEqual(['b', 'z', 'c']);
  expect(result.sources.map(s => s.id)).toEqual(['other', 'aaa', 'watch']);
});
