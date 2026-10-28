import { SetType, MuscleGroup, type PlannedSession, type RehabBlock } from '@/models';
import { restAfterCompletion, updateWorkoutSet } from '../workoutExecution';
import { IDLE_REST_TIMER, remainingSeconds } from '../restTimer';
import { toSessionSetsByExercise, toWorkoutSession, type SessionSetState } from '../sessionMapper';
import { cleanSupersets, linkSuperset, unlinkSuperset, supersetTransition, removeWorkoutExercise } from '../workoutStructure';
import { wheelValues, displayLoad, storedLoad } from '../numericWheel';
import { EXERCISE_CATALOGUE } from '../exerciseCatalogue';
import { groupByBodyHalf } from '../muscleGroups';
import { workoutPlanChanges, prescriptionFromWorkout } from '../workoutReview';
import { validateAppSettings } from '@/services/settings/appSettings';
import { newRehabLog, validateRehabLog } from '../rehabilitation';
import { patchRehabRow, rehabRows, reshapeRehab, rehabSupersets, linkRehabSuperset } from '../rehabExecution';
const row = (id: string): SessionSetState => ({ id, setType: SetType.NORMAL, targetWeight: 20, targetReps: 10, targetRIR: 2, isCompleted: false, isAutoFilled: false });
const done = (id: string) => ({ ...row(id), actualWeight: 20, actualReps: 10, isCompleted: true });
it('starts first rest, restarts every subsequent completion and ignores checked-row corrections after resume', () => {
  let timer = IDLE_REST_TIMER;
  const context = { sessionId: 'fixture', userId: 'owner', mesocycleId: 'm', microcycleId: 'm0', microcycleIndex: 0, performedAt: 1 };
  let sets = { a: [row('first'), row('second'), row('third')] };
  for (let i = 0; i < 3; i++) {
    const before = sets.a[i]; const next = done(before.id); const now = 10000 + i * 17000;
    timer = restAfterCompletion(before, next, timer, 90, now);
    expect(timer).toEqual({ startedAt: now, durationSeconds: 90, anchorSetId: before.id });
    expect(remainingSeconds(timer, now)).toBe(90);
    expect(restAfterCompletion(next, { ...next, actualWeight: 25 }, timer, 90, now + 5000)).toBe(timer);
    sets.a[i] = next;
    sets = toSessionSetsByExercise(toWorkoutSession(context, ['a'], sets)) as typeof sets;
  }
  expect(restAfterCompletion(row('earlier'), done('earlier'), timer, 60, 100000).anchorSetId).toBe('earlier');
  expect(restAfterCompletion(undefined, done('missing'), timer, 60, 100000)).toBe(timer);
  expect(restAfterCompletion(row('invalid'), { ...row('invalid'), isCompleted: true }, timer, 60, 100000)).toBe(timer);
  const cleared = updateWorkoutSet(done('corrected'), { actualWeight: undefined });
  expect(cleared.isCompleted).toBe(false);
  const corrected = updateWorkoutSet(cleared, { actualWeight: 25, isCompleted: true });
  expect(restAfterCompletion(cleared, corrected, timer, 60, 100000)).toBe(timer);
  const unchecked = updateWorkoutSet(corrected, { isCompleted: false });
  expect(restAfterCompletion(unchecked, updateWorkoutSet(unchecked, { isCompleted: true }), timer, 60, 100000).startedAt).toBe(100000);
});
it('keeps anatomical summary order independent of seed, volume and insertion order', () => {
  const entries = [MuscleGroup.TRICEPS, MuscleGroup.CHEST, MuscleGroup.QUADS, MuscleGroup.LATS].map((muscle) => ({ muscle, sets: 1 }));
  expect(groupByBodyHalf(entries)).toEqual(groupByBodyHalf([...entries].reverse()));
  expect(groupByBodyHalf(entries)[0].entries.map((entry) => entry.muscle)).toEqual([MuscleGroup.CHEST, MuscleGroup.LATS, MuscleGroup.TRICEPS]);
});
it('links, unlinks, persists and advances uneven supersets without inventing completion or transition rest', () => {
  const order = ['a', 'b', 'c']; const groups = linkSuperset(order, {}, 'a', 'b');
  expect(cleanSupersets(['a'], groups)).toEqual({}); expect(unlinkSuperset(order, groups, 'b')).toEqual({});
  expect(linkSuperset(order, groups, 'a', 'a')).toEqual(groups);
  expect(linkSuperset(order, groups, 'missing', 'a')).toEqual(groups);
  const sets = { a: [done('a1'), row('a2')], b: [row('b1')], c: [row('c1')] };
  expect(supersetTransition(order, groups, sets, 'a')).toEqual({ next: 'b', rest: false });
  sets.b[0] = done('b1'); expect(supersetTransition(order, groups, sets, 'b')).toEqual({ next: 'a', rest: true });
  expect(supersetTransition(order, groups, sets, 'c')).toEqual({ next: null, rest: true });
  const removed = removeWorkoutExercise(EXERCISE_CATALOGUE.slice(0, 2), { [EXERCISE_CATALOGUE[0].id]: [done('recorded')] }, EXERCISE_CATALOGUE[0].id);
  expect(removed.exercises).toEqual([EXERCISE_CATALOGUE[1]]); expect(removed.sets).toEqual({});
});
it('does not turn achieved reps, kg or RIR into an edited prescription', () => {
  const exercise = EXERCISE_CATALOGUE[0]; const base: PlannedSession = { index: 0, focus: 'UPPER', estimatedWorkMinutes: 10,
    exercises: [{ exerciseId: exercise.id, order: 0, isEdited: false, sets: [{ setType: SetType.NORMAL, targetRepsMin: 8, targetReps: 10, targetRIR: 2 }] }] };
  const sets = { [exercise.id]: [{ ...done('s'), actualReps: 6, actualWeight: 35, actualRIR: 0 }] };
  expect(workoutPlanChanges(base, [exercise], sets)).toEqual([]);
  expect(prescriptionFromWorkout(base, [exercise], sets).exercises[0].sets[0]).toMatchObject({ targetRepsMin: 8, targetReps: 10, targetRIR: 2 });
});
it('preserves quarter increments, canonical kg and bounded integer reps', () => {
  expect(wheelValues(20, 0.25, 10000)).toContain(20.25);
  expect(wheelValues(0, 1, 999)[0]).toBe(0); expect(wheelValues(999, 1, 999).at(-1)).toBe(999);
  expect(wheelValues(undefined, 1, 999)[0]).toBe(0);
  for (const invalid of [NaN, 0, -1]) expect(() => wheelValues(10, invalid, 999)).toThrow();
  for (const unit of ['kg', 'lb'] as const) expect(storedLoad(displayLoad(20.25, unit), unit)).toBeCloseTo(20.25, 5);
  for (const invalid of [NaN, Infinity, -1]) { expect(() => displayLoad(invalid, 'kg')).toThrow(); expect(() => storedLoad(invalid, 'lb')).toThrow(); }
  expect(validateAppSettings({ appearance: 'system', language: 'system', measurementSystem: 'imperial', weightIncrement: 0.25 }).weightIncrement).toBe(0.25);
  for (const weightIncrement of [0, NaN, 101]) expect(() => validateAppSettings({ appearance: 'system', language: 'system', weightIncrement })).toThrow();
  expect(() => validateAppSettings({ appearance: 'system', language: 'system', measurementSystem: 'stone' })).toThrow();
});
it('maps rehab actuals through the same row contract and preserves them through reshaping', () => {
  const exercise = EXERCISE_CATALOGUE[0]; const block: RehabBlock = { id: 'b', userId: 'owner', version: 1, name: 'Fixture', active: true, createdAt: 1, updatedAt: 1,
    schedule: { kind: 'WEEKLY', target: 1 }, items: [{ id: 'a', exerciseId: exercise.id, exerciseSnapshot: exercise, sets: 2, min: 8, max: 10, load: 20, restSeconds: 30, notes: '' }] };
  let log = newRehabLog(block, '2026-10-25', 1); const rows = rehabRows(log, block.items[0]);
  log = patchRehabRow(log, block.items[0], rows[0].id, { actualWeight: 20, actualReps: 8, isCompleted: true, setType: SetType.FAILURE }, 2);
  expect(log.sets[0]).toMatchObject({ completed: true, rir: 0, actual: 8 }); validateRehabLog(log);
  const emptied = reshapeRehab(log, [{ ...block.items[0], sets: 0 }], 3); expect(emptied.sets).toEqual([]); validateRehabLog(emptied);
  validateRehabLog(reshapeRehab(log, [], 3));
  expect(() => patchRehabRow(log, block.items[0], 'missing', {}, 3)).toThrow();
  const items = ['a', 'b', 'c'].map((id) => ({ ...block.items[0], id }));
  const linked = linkRehabSuperset(items, 'a', 'c');
  expect(linked.map((item) => item.id)).toEqual(['a', 'c', 'b']);
  expect(rehabSupersets(linked)).toEqual({ a: 'a', c: 'a' });
  expect(rehabSupersets(linkRehabSuperset(linked, 'c'))).toEqual({});
});
