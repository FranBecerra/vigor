import { SetType } from '@/models';
import { EXERCISE_CATALOGUE } from '../exerciseCatalogue';
import { editNumericDraft, nextExerciseAfterCompletion, updateWorkoutSet } from '../workoutExecution';
import { sessionProgress, toSessionSetsByExercise, toWorkoutSession, type SessionSetState } from '../sessionMapper';
import { workoutReview } from '../workoutReview';

const row = (id: string, patch: Partial<SessionSetState> = {}): SessionSetState => ({
  id, setType: SetType.NORMAL, targetWeight: 20, targetReps: 10, targetRIR: 2,
  isAutoFilled: false, isCompleted: false, ...patch,
});
const context = { sessionId: 'test-only', userId: 'fixture', mesocycleId: 'm', microcycleId: 'm0', microcycleIndex: 0, performedAt: 1 };

it('keeps valid actual corrections complete but unchecks a row when a required actual is cleared', () => {
  const done = row('s', { isCompleted: true, actualWeight: 35, actualReps: 8, completionState: 'PENDING' });
  expect(updateWorkoutSet(done, { actualWeight: 40 })).toMatchObject({ isCompleted: true, actualWeight: 40 });
  expect(updateWorkoutSet(done, { actualWeight: undefined }).isCompleted).toBe(false);
  expect(updateWorkoutSet(row('s'), { actualWeight: 30 }).isCompleted).toBe(false);
  expect(done.actualWeight).toBe(35);
});

it('counts the whole workout after save, resume, completion and another save/resume', () => {
  const exercises = EXERCISE_CATALOGUE.slice(0, 7); const order = exercises.map((exercise) => exercise.id);
  const initial = Object.fromEntries(order.map((id) => [id, [row(`${id}:w`, { setType: SetType.WARMUP }), ...Array.from({ length: 3 }, (_, i) => row(`${id}:${i}`))]]));
  const saved = toWorkoutSession(context, order, initial);
  const restored = toSessionSetsByExercise(JSON.parse(JSON.stringify(saved)));
  // The screen changes isCompleted/actuals, retaining the old PENDING serialized flag.
  for (const sets of Object.values(restored)) for (const set of sets) Object.assign(set, { isCompleted: true, actualWeight: 20, actualReps: 10 });
  expect(restored[order[0]][1].completionState).toBe('PENDING');
  expect(workoutReview(exercises, restored, [], context.sessionId)).toMatchObject({ completed: 21, pending: 0, tonnage: 4200 });
  expect(sessionProgress(restored)).toEqual({ completed: 21, total: 21 });
  const roundtrip = toSessionSetsByExercise(toWorkoutSession(context, order, restored));
  expect(workoutReview(exercises, roundtrip, [], context.sessionId)).toEqual(workoutReview(exercises, restored, [], context.sessionId));
  roundtrip[order[0]][1].isCompleted = false;
  expect(workoutReview(exercises, roundtrip, [], context.sessionId)).toMatchObject({ completed: 20, pending: 1, tonnage: 4000 });
});

it('ignores pending warmups, invalid actuals and untouched muscles in the review', () => {
  const exercise = EXERCISE_CATALOGUE[0];
  const sets = { [exercise.id]: [row('w', { setType: SetType.WARMUP }), row('invalid', { isCompleted: true })] };
  expect(workoutReview([exercise], sets, [], 's')).toMatchObject({ completed: 0, pending: 1, tonnage: 0, volumes: [] });
});

it('retains an empty exercise in an actively persisted draft after deleting its last set', () => {
  const saved = toWorkoutSession({ ...context, persistDraft: true }, ['empty', 'second'], { empty: [], second: [row('s')] });
  expect(saved.exercises.map((exercise) => exercise.exerciseId)).toEqual(['empty', 'second']);
  expect(toSessionSetsByExercise(saved).empty).toEqual([]);
});

it('advances to the next unfinished exercise, skipping completed entries without wrapping', () => {
  const done = row('d', { isCompleted: true, actualWeight: 0, actualReps: 10, completionState: 'PENDING' });
  const sets = { a: [done, row('w', { setType: SetType.WARMUP })], b: [done], c: [row('c')] };
  expect(nextExerciseAfterCompletion(['a', 'b', 'c'], sets, 'a')).toBe(2);
  expect(nextExerciseAfterCompletion(['a', 'b', 'c'], sets, 'c')).toBeNull();
  expect(nextExerciseAfterCompletion(['a'], sets, 'a')).toBeNull();
  expect(nextExerciseAfterCompletion(['x'], { x: [row('w', { setType: SetType.WARMUP })] }, 'x')).toBeNull();
  expect(nextExerciseAfterCompletion([], sets, 'missing')).toBeNull();
  expect(nextExerciseAfterCompletion(['a', 'x'], sets, 'a')).toBeNull();
  expect(nextExerciseAfterCompletion(['x'], {}, 'x')).toBeNull();
});

it('keeps numeric drafts empty and accepts decimal loads without leading zero pollution', () => {
  expect(editNumericDraft('10', 'clear', true)).toBe('');
  expect(editNumericDraft('', '3', true)).toBe('3');
  expect(editNumericDraft('3', '5', true)).toBe('35');
  expect(editNumericDraft('0', '3', true)).toBe('3');
  expect(editNumericDraft('10', 'backspace', true)).toBe('1');
  expect(editNumericDraft('', '.', true)).toBe('0.');
  expect(editNumericDraft('2', '.', true)).toBe('2.');
  expect(editNumericDraft('2.', '.', true)).toBe('2.');
  expect(editNumericDraft('2', '.', false)).toBe('2');
  expect(editNumericDraft('2', 'letter', false)).toBe('2');
  expect(editNumericDraft('1234567', '8', false)).toBe('1234567');
});
