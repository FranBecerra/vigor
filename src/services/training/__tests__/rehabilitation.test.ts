import type { RehabBlock } from '@/models';
import { createCustomExercise } from '../customExercises';
import { finishRehabLog, localDateKey, newRehabLog, rehabIsDue, rehabSetComplete, rehabWeekCompletions,
  skipRehabLog, updateRehabSet, validateRehabBlock, validateRehabLog, weekStartKey } from '../rehabilitation';

const exercise = createCustomExercise({ name: 'My hold', recording: { measure: 'SECONDS', load: 'NONE' } }, 'u', 'custom:u:1', [], 1);
const block = (): RehabBlock => ({ id: 'block', userId: 'u', version: 1, name: 'Pre workout', active: true,
  createdAt: 1, updatedAt: 1, schedule: { kind: 'WEEKLY', target: 2 },
  items: [{ id: 'item', exerciseId: exercise.id, exerciseSnapshot: exercise, sets: 2, min: 20, max: 30, restSeconds: 30, notes: '' }] });
const completed = (date: string) => {
  let log = newRehabLog(block(), date, 1);
  for (const row of log.sets) log = updateRehabSet(log, row.itemId, row.index, { actual: 25, completed: true }, 2);
  return finishRehabLog(log, 3);
};
it('validates an independent user-authored block without a clinical injury or phase', () => {
  expect(() => validateRehabBlock(block())).not.toThrow();
  expect(block().injuryId).toBeUndefined();
});
it.each([
  { name: '' }, { name: 'a'.repeat(121) }, { version: 2 }, { userId: '' }, { updatedAt: NaN },
  { items: [] }, { schedule: { kind: 'WEEKLY', target: 0 } }, { schedule: { kind: 'WEEKLY', target: 8 } },
  { schedule: { kind: 'WEEKLY', target: 1.5 } }, { schedule: { kind: 'DAYS', days: [] } },
  { schedule: { kind: 'DAYS', days: [1, 1] } }, { schedule: { kind: 'DAYS', days: [0] } }, { schedule: { kind: 'INVALID' } },
])('rejects malformed blocks: %j', (patch) => expect(() => validateRehabBlock({ ...block(), ...patch } as never)).toThrow());
it.each([
  { sets: 0 }, { sets: 21 }, { min: 0 }, { min: 31 }, { max: 3601 }, { min: 1.5 },
  { restSeconds: -1 }, { restSeconds: Infinity }, { restSeconds: 3601 }, { load: 5 }, { notes: 'a'.repeat(2001) },
  { exerciseId: 'other' }, { exerciseSnapshot: { ...exercise, ownerId: 'foreign' } },
])('rejects invalid or foreign prescriptions: %j', (patch) => {
  const b = block(); b.items = [{ ...b.items[0], ...patch }]; expect(() => validateRehabBlock(b)).toThrow();
});
it('allows repeated exercise identities only as distinct prescription occurrences', () => {
  const b = block(); b.items.push({ ...b.items[0] });
  expect(() => validateRehabBlock(b)).toThrow('invalidItems');
  b.items[1].id = 'second'; expect(() => validateRehabBlock(b)).not.toThrow();
});
it('uses Monday calendar weeks and civil dates across DST rather than seven-day microcycles', () => {
  expect(weekStartKey('2026-10-25')).toBe('2026-10-19');
  expect(weekStartKey('2026-10-26')).toBe('2026-10-26');
  expect(localDateKey(new Date(2026, 9, 25, 23, 30))).toBe('2026-10-25');
  expect(() => weekStartKey('2026-02-30')).toThrow();
  expect(() => weekStartKey('2026-2-1')).toThrow();
  expect(() => localDateKey(new Date(NaN))).toThrow();
  expect(rehabWeekCompletions(block(), [completed('2026-10-18'), completed('2026-10-19'), completed('2026-10-20'), completed('2026-10-25')], '2026-10-21')).toBe(2);
});
it('counts only own completed, distinct, non-future dates in the current week', () => {
  const log = completed('2026-10-19');
  expect(rehabWeekCompletions(block(), [log, log, { ...log, userId: 'other' }, { ...log, blockId: 'other' },
    { ...log, date: '2026-10-20bad' }, { ...log, status: 'SKIPPED' }], '2026-10-21')).toBe(1);
  expect(rehabIsDue(block(), [log, completed('2026-10-20')], '2026-10-21')).toBe(false);
  expect(rehabIsDue(block(), [log], '2026-10-21')).toBe(true);
});
it('offers selected days, skips per workout, and independent rest-day completion', () => {
  const b = { ...block(), schedule: { kind: 'DAYS', days: [1, 3] } } as RehabBlock;
  expect(rehabIsDue(b, [], '2026-10-19')).toBe(true);
  expect(rehabIsDue(b, [], '2026-10-20')).toBe(false);
  expect(rehabIsDue({ ...b, active: false }, [], '2026-10-19')).toBe(false);
  expect(rehabIsDue({ ...b, archivedAt: 1 }, [], '2026-10-19')).toBe(false);
  const skipped = skipRehabLog(newRehabLog(b, '2026-10-19', 1, 'strength:m0:s0'), 2);
  expect(rehabIsDue(b, [skipped], '2026-10-19', 'strength:m0:s0')).toBe(false);
  expect(rehabIsDue(b, [skipped], '2026-10-19', 'strength:m0:s1')).toBe(true);
  expect(rehabIsDue(b, [skipped], '2026-10-19')).toBe(true);
  expect(rehabIsDue(b, [completed('2026-10-19')], '2026-10-19')).toBe(false);
});
it('preserves partial rows, units and snapshots without mutating a strength session or plan', () => {
  const b = block(), before = JSON.stringify(b);
  const original = newRehabLog(b, '2026-10-19', 1);
  let next = updateRehabSet(original, 'item', 0, { actual: 25, completed: true }, 2);
  expect(original.sets[0].actual).toBeUndefined(); expect(original.status).toBe('IN_PROGRESS');
  expect(() => finishRehabLog(next, 3)).toThrow('incompleteBlock');
  next = updateRehabSet(next, 'item', 1, { actual: 20, completed: true }, 3);
  const done = finishRehabLog(next, 4);
  expect(() => validateRehabLog(JSON.parse(JSON.stringify(done)))).not.toThrow();
  expect(done.sets[0].recording.measure).toBe('SECONDS');
  expect(done).not.toHaveProperty('microcycleIndex'); expect(done).not.toHaveProperty('plannedSessionIndex');
  const pending = updateRehabSet(done, 'item', 0, { completed: false }, 5);
  expect(pending.status).toBe('IN_PROGRESS'); expect(pending.completedAt).toBeUndefined();
  expect(skipRehabLog(done, 5).completedAt).toBeUndefined();
  expect(JSON.stringify(b)).toBe(before);
  b.items[0].exerciseSnapshot.name = 'Changed later';
  expect(done.blockSnapshot.items[0].exerciseSnapshot.name).toBe('My hold');
});
it('requires actual positive reps/time and the correct load when completing a set', () => {
  const log = newRehabLog(block(), '2026-10-19', 1);
  expect(() => updateRehabSet(log, 'missing', 0, {}, 2)).toThrow();
  for (const actual of [0, -1, NaN, Infinity, 0.5, 3601]) expect(() => updateRehabSet(log, 'item', 0, { actual, completed: true }, 2)).toThrow();
  expect(rehabSetComplete({ ...log.sets[0], actual: 12, recording: { measure: 'REPETITIONS', load: 'LEVEL' } })).toBe(false);
  expect(rehabSetComplete({ ...log.sets[0], actual: 12, load: 3, recording: { measure: 'REPETITIONS', load: 'LEVEL' } })).toBe(true);
});
it.each(['userId', 'blockId', 'id', 'date', 'status', 'workoutKey'])('rejects invalid log identity/scope: %s', (key) => {
  expect(() => validateRehabLog({ ...completed('2026-10-19'), [key]: '' })).toThrow();
});
it('rejects forged completion, row counts, units and contradictory completion timestamps', () => {
  const done = completed('2026-10-19');
  expect(() => validateRehabLog({ ...done, sets: [] })).toThrow();
  expect(() => validateRehabLog({ ...done, completedAt: undefined })).toThrow();
  expect(() => validateRehabLog({ ...done, status: 'IN_PROGRESS' })).toThrow();
  expect(() => validateRehabLog({ ...done, sets: done.sets.map((row) => ({ ...row, actual: undefined })) })).toThrow();
  expect(() => validateRehabLog({ ...done, sets: done.sets.map((row) => ({ ...row, recording: { measure: 'REPETITIONS', load: 'NONE' } })) })).toThrow();
});
