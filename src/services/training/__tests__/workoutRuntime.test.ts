import { formatWorkoutTime, latestUnfinishedWorkout, moveWorkoutExercise, timestampMillis, workoutElapsedSeconds } from '../workoutRuntime';
import { toWorkoutSession, toSessionSetsByExercise } from '../sessionMapper';
import { SetType, type WorkoutSession } from '@/models';

const sets = { a: [{ id: 'a1', setType: SetType.NORMAL, targetWeight: 20, targetReps: 10, targetRIR: 2, isAutoFilled: false, isCompleted: false }],
  b: [{ id: 'b1', setType: SetType.NORMAL, targetWeight: 30, targetReps: 8, targetRIR: 1, isAutoFilled: false, isCompleted: true, actualWeight: 30, actualReps: 8 }] };
const context = { sessionId: 's', userId: 'u', mesocycleId: 'm', microcycleId: 'm0', microcycleIndex: 0, plannedSessionIndex: 0, performedAt: 1000 };
const session = (patch: Partial<WorkoutSession> = {}) => ({ ...toWorkoutSession(context, ['a', 'b'], sets), ...patch });

it('keeps runtime, notes, set identity and work when reordering and serializing a draft', () => {
  const runtime = { trainingGoal: 'HYPERTROPHY', sessionName: 'Upper', activeExerciseId: 'b',
    restTimer: { startedAt: 5000, durationSeconds: 120, anchorSetId: 'b1' }, exerciseNotes: { a: 'Use the low seat' } };
  const saved = toWorkoutSession({ ...context, ...runtime, persistDraft: true }, moveWorkoutExercise(['a', 'b'], 0, 1), sets);
  const { exerciseNotes, ...metadata } = runtime;
  expect(saved).toMatchObject({ ...metadata, performedAt: 1000, exercises: [ { exerciseId: 'b', order: 0 }, { exerciseId: 'a', order: 1, notes: 'Use the low seat' } ] });
  expect(toSessionSetsByExercise(saved)).toMatchObject(sets);
  expect(toWorkoutSession({ ...context, exerciseNotes: { a: '' } }, ['a'], sets).exercises[0].notes).toBe('');
});

it('resumes the latest pending session, including untouched prescriptions and legacy metadata', () => {
  const older = session({ id: 'older' }); const latest = session({ id: 'latest', performedAt: { seconds: 3, nanoseconds: 500000000 } });
  expect(latestUnfinishedWorkout([session({ id: 'completed', performedAt: 5000, completedAt: 6000 }), older, latest])).toEqual(latest);
  expect(timestampMillis(latest.performedAt)).toBe(3500);
  expect(latestUnfinishedWorkout([older])).toEqual(older);
  expect(latestUnfinishedWorkout([session({ exercises: [] }), session({ plannedSessionIndex: undefined }), session({ microcycleIndex: -1 }), session({ plannedSessionIndex: 0.5 }), session({ mesocycleId: '' })])).toBeNull();
  expect(latestUnfinishedWorkout([])).toBeNull();
});

it('uses wall-clock duration through suspension and freezes the finish time', () => {
  expect(workoutElapsedSeconds(1000, 126900)).toBe(125);
  expect(workoutElapsedSeconds(1000, 800000, 126900)).toBe(125);
  expect(workoutElapsedSeconds(2000, 1000)).toBe(0);
  expect(workoutElapsedSeconds(NaN, 1000)).toBe(0);
  expect(workoutElapsedSeconds(1000, NaN)).toBe(0);
  expect(formatWorkoutTime(0)).toBe('0:00');
  expect(formatWorkoutTime(65)).toBe('1:05');
  expect(formatWorkoutTime(3661)).toBe('61:01');
  expect(formatWorkoutTime(-4)).toBe('0:00');
  expect(formatWorkoutTime(Infinity)).toBe('0:00');
});

it('moves across multiple positions without mutating exercises and rejects invalid gestures', () => {
  const source = ['a', 'b', 'c', 'd'];
  expect(moveWorkoutExercise(source, 0, 3)).toEqual(['b', 'c', 'd', 'a']);
  expect(moveWorkoutExercise(source, 3, 0)).toEqual(['d', 'a', 'b', 'c']);
  expect(source).toEqual(['a', 'b', 'c', 'd']);
  for (const [from, to] of [[-1, 0], [0, 10], [NaN, 1], [0, 0.5], [10, 0]]) expect(moveWorkoutExercise(source, from, to)).toEqual(source);
  expect(moveWorkoutExercise([], 0, 0)).toEqual([]);
});
