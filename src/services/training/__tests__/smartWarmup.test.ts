import { ExerciseProfile, MuscleGroup, SetType, type Exercise, type WorkoutSession } from '@/models';
import { EXERCISE_CATALOGUE } from '../exerciseCatalogue';
import { canSuggestWarmup, smartWarmup, warmupReference } from '../smartWarmup';
import { toWorkoutSession, type SessionSetState } from '../sessionMapper';
import { workoutReview } from '../workoutReview';

const exercise: Exercise = { ...EXERCISE_CATALOGUE[0], id: 'fixture', primaryMuscle: MuscleGroup.CHEST, primaryMuscles: [MuscleGroup.CHEST], profile: ExerciseProfile.COMPOUND_PRIMARY };
const row: SessionSetState = { id: 'work', setType: SetType.NORMAL, targetWeight: 70, targetReps: 8, targetRIR: 2, isAutoFilled: false, isCompleted: false };
it('offers the first compound per primary target, not isolations, finished work, duplicate warmups or unsafe units', () => {
  expect(canSuggestWarmup([exercise], 0, [row])).toBe(true);
  expect(canSuggestWarmup([], 0, [])).toBe(false);
  expect(canSuggestWarmup([exercise, exercise], 1, [row])).toBe(false);
  const legs = { ...exercise, id: 'legs', primaryMuscle: MuscleGroup.QUADS, primaryMuscles: [MuscleGroup.QUADS] };
  expect(canSuggestWarmup([exercise, legs], 1, [row])).toBe(true);
  for (const profile of [ExerciseProfile.ISOLATION, ExerciseProfile.UNCLASSIFIED]) expect(canSuggestWarmup([{ ...exercise, profile }], 0, [row])).toBe(false);
  expect(canSuggestWarmup([{ ...exercise, primaryMuscle: MuscleGroup.UNCLASSIFIED, primaryMuscles: [] }], 0, [row])).toBe(false);
  expect(canSuggestWarmup([exercise], 0, [{ ...row, isCompleted: true }])).toBe(false);
  expect(canSuggestWarmup([exercise], 0, [{ ...row, setType: SetType.WARMUP }])).toBe(false);
  for (const load of ['NONE', 'LEVEL', 'ASSISTANCE_KG', 'ADDED_KG'] as const) expect(canSuggestWarmup([{ ...exercise, recording: { measure: 'REPETITIONS', load } }], 0, [])).toBe(false);
  expect(canSuggestWarmup([{ ...exercise, recording: { measure: 'SECONDS', load: 'TOTAL_KG' } }], 0, [])).toBe(false);
  expect(canSuggestWarmup([{ ...exercise, recording: { measure: 'REPETITIONS', load: 'PER_HAND_KG' } }], 0, [])).toBe(true);
});
it('produces a low-volume ramp, rounds down to available increments and stays below working load', () => {
  expect(smartWarmup(100, 2.5, 80)).toEqual([{ percent: 40, weight: 40, reps: 8 }, { percent: 55, weight: 55, reps: 5 }, { percent: 70, weight: 70, reps: 3 }]);
  expect(smartWarmup(100, 2.5, 50)).toEqual([{ percent: 40, weight: 40, reps: 8 }, { percent: 55, weight: 45, reps: 5 }]);
  expect(smartWarmup(10, 20, undefined)).toEqual([]);
  expect(smartWarmup(100, 0.5, 0)).toHaveLength(3);
  expect(smartWarmup(100, 0.1, undefined, [{ percent: 42.4, reps: 3 }])[0].weight).toBe(42.4);
});
it.each([0, -1, NaN, Infinity, 10001])('rejects an invalid reference RM: %p', (rm) => expect(smartWarmup(rm, 2.5, 80)).toEqual([]));
it.each([0, -1, NaN, Infinity, 101])('rejects an invalid equipment increment: %p', (increment) => expect(smartWarmup(100, increment, 80)).toEqual([]));
it.each([[], [{ percent: 0, reps: 8 }], [{ percent: 81, reps: 8 }], [{ percent: NaN, reps: 8 }], [{ percent: 40, reps: 0 }], [{ percent: 40, reps: 16 }],
  [{ percent: 40, reps: 1.5 }], [{ percent: 60, reps: 3 }, { percent: 40, reps: 3 }], Array.from({ length: 7 }, () => ({ percent: 40, reps: 8 }))].map((steps) => ({ steps })))('rejects malformed or excessive ramps', ({ steps }) => expect(smartWarmup(100, 2.5, 80, steps)).toEqual([]));
it('uses completed, recent, compatible history, not stale, discarded or pending rows', () => {
  const now = Date.UTC(2026, 9, 23);
  const source = (patch: Partial<WorkoutSession> = {}) => ({ ...toWorkoutSession({ sessionId: 'past', userId: 'fixture', mesocycleId: 'm', microcycleId: 'm0', microcycleIndex: 0, performedAt: now - 2000, completedAt: now - 1000,
    exerciseSnapshots: { fixture: exercise } }, ['fixture'], { fixture: [{ ...row, actualWeight: 70, actualReps: 8, isCompleted: true }] }), ...patch });
  expect(warmupReference(exercise, [source()], now)).toBeCloseTo(70 * (1 + 8 / 30));
  for (const patch of [{ completedAt: undefined }, { discardedAt: now }, { completedAt: now - 43 * 86400000 }, { completedAt: now + 1000 }]) expect(warmupReference(exercise, [source(patch)], now)).toBeUndefined();
  const pending = source(); pending.exercises[0].sets[0].completionState = 'PENDING';
  expect(warmupReference(exercise, [pending], now)).toBeUndefined();
  expect(warmupReference({ ...exercise, recording: { measure: 'REPETITIONS', load: 'PER_HAND_KG' } }, [source()], now)).toBeUndefined();
  const incompatible = source(); incompatible.exercises[0].exerciseSnapshot = { ...exercise, recording: { measure: 'SECONDS', load: 'TOTAL_KG' } };
  expect(warmupReference(exercise, [incompatible], now)).toBeUndefined();
});
it('does not count generated warmups as working volume, pending work, or PRs', () => {
  const warmups = smartWarmup(100, 2.5, 80).map((warm, index) => ({ ...row, id: `w${index}`, setType: SetType.WARMUP, actualWeight: warm.weight, actualReps: warm.reps, isCompleted: true }));
  expect(workoutReview([exercise], { fixture: warmups }, [], 'now')).toMatchObject({ completed: 0, pending: 0, tonnage: 0, volumes: [], records: [] });
});
