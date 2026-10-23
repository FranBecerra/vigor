import { MuscleGroup, SetType, type Exercise, type WorkoutSession, type WorkoutSet } from '@/models';
import { workoutHistoryDetails } from '../workoutHistory';
const row = (patch: Partial<WorkoutSet> = {}): WorkoutSet => ({ id: 'set', setType: SetType.NORMAL, targetWeight: 100,
  targetReps: 12, targetRIR: 4, actualWeight: 20, actualReps: 10, isAutoFilled: false, completionState: 'DONE', ...patch });
const session = (sets: WorkoutSet[]): WorkoutSession => ({ id: 's', userId: 'u', mesocycleId: 'm', microcycleId: 'mi', microcycleIndex: 0,
  performedAt: 1000, completedAt: 61000, exercises: [{ id: 'missing', exerciseId: 'missing', order: 0, isSwap: false, sets }] });
it('retains missing catalogue exercises and separates real work, warmups, missing effort and pending rows', () => {
  const input = session([row({ id: 'w', setType: SetType.WARMUP, actualRIR: 4 }), row({ actualRIR: 2 }),
    row({ id: 'zero', actualWeight: 0, actualRIR: 0 }), row({ id: 'unknown', actualRIR: null }),
    row({ id: 'pending', completionState: 'PENDING', actualWeight: undefined, actualReps: undefined })]);
  const details = workoutHistoryDetails(input, new Map());
  expect(details).toMatchObject({ working: 3, warmups: 1, tonnage: 400, meanRIR: 1, durationSeconds: 60 });
  expect(details.exercises[0]).toMatchObject({ name: null, note: null, completed: 3 });
  expect(details.exercises[0].sets.at(-1)).toMatchObject({ done: false, weight: null, quantity: null, rir: null });
  expect(details.exercises[0].sets[0].number).toBeNull(); expect(details.exercises[0].sets[1].number).toBe(1);
  expect(input.exercises[0].sets[1].targetRIR).toBe(4);
});
it('sums valid completed advanced segments without merging their recorded repetitions', () => {
  const details = workoutHistoryDetails(session([row({ setType: SetType.DROP_SET, extensions: [{ reps: 3 }, { weight: 10, reps: 4 }, { weight: -1, reps: 2 }, { reps: 0 }, { reps: NaN }] })]), new Map());
  expect(details.tonnage).toBe(300); expect(details.working).toBe(1);
  expect(details.exercises[0].sets[0].extensions[0]).toEqual({ weight: null, reps: 3 });
});
it('supports custom timed/level/no-load records and does not invent comparable kg tonnage', () => {
  for (const load of ['NONE', 'LEVEL', 'ASSISTANCE_KG', 'TOTAL_KG'] as const) {
    const details = workoutHistoryDetails(session([row({ recording: { measure: 'SECONDS', load }, actualDurationSeconds: 30, actualLoadLevel: 4 })]), new Map());
    expect(details.tonnage).toBe(0); expect(details.working).toBe(1);
    expect(details.exercises[0].sets[0]).toMatchObject({ seconds: true, quantity: 30, weight: load === 'NONE' ? null : load === 'LEVEL' ? 4 : 20 });
  }
});
it('uses execution snapshots before catalogue labels, preserves order/notes and filters invalid actuals', () => {
  const input = session([row({ actualWeight: NaN }), row({ actualRIR: 6 }), row({ actualReps: 0 })]);
  input.exercises[0].exerciseSnapshot = { name: 'Snapshot name' } as Exercise;
  input.exercises[0].notes = 'Seat 4'; input.exercises.push({ ...input.exercises[0], id: 'first', exerciseId: 'catalogue', order: -1, exerciseSnapshot: undefined, sets: [] });
  const details = workoutHistoryDetails(input, new Map([['catalogue', { name: 'Catalogue name' } as Exercise]]));
  expect(details.exercises.map((exercise) => exercise.name)).toEqual(['Catalogue name', 'Snapshot name']);
  expect(details.exercises[1].note).toBe('Seat 4'); expect(details.working).toBe(1); expect(details.meanRIR).toBeNull();
  expect(input.exercises[0].id).toBe('missing');
});
it('has no duration or average for unfinished/invalid-time/empty records', () => {
  const input = session([]); input.completedAt = undefined;
  expect(workoutHistoryDetails(input, new Map())).toMatchObject({ durationSeconds: null, meanRIR: null, working: 0 });
  input.completedAt = 0; expect(workoutHistoryDetails(input, new Map()).durationSeconds).toBeNull();
  input.performedAt = NaN; expect(workoutHistoryDetails(input, new Map()).durationSeconds).toBeNull();
  input.performedAt = 1000; input.completedAt = Infinity; expect(workoutHistoryDetails(input, new Map()).durationSeconds).toBeNull();
  input.performedAt = { seconds: 1, nanoseconds: 0 }; input.completedAt = { seconds: 61, nanoseconds: 0 };
  expect(workoutHistoryDetails(input, new Map()).durationSeconds).toBe(60);
});
it('builds stable muscle capsules from executed snapshots, never pending or warmup sets', () => {
  const input = session([row(), row({ setType: SetType.WARMUP }), row({ completionState: 'PENDING', actualWeight: undefined })]);
  input.sessionNote = 'Today only'; input.mesocycleNote = 'This block'; input.exercises[0].exerciseNote = 'Seat 4';
  input.exercises[0].exerciseSnapshot = { name: 'Saved press', primaryMuscle: MuscleGroup.CHEST,
    primaryMuscles: [MuscleGroup.CHEST, MuscleGroup.TRICEPS], secondaryMuscles: [MuscleGroup.TRICEPS, MuscleGroup.DELTS_FRONT, MuscleGroup.UNCLASSIFIED] } as Exercise;
  const details = workoutHistoryDetails(input, new Map([['missing', { primaryMuscle: MuscleGroup.QUADS } as Exercise]]));
  expect(details.volumes).toEqual([{ muscle: MuscleGroup.CHEST, sets: 1 }, { muscle: MuscleGroup.TRICEPS, sets: 1 }, { muscle: MuscleGroup.DELTS_FRONT, sets: 0.5 }]);
  expect(details).toMatchObject({ sessionNote: 'Today only', mesocycleNote: 'This block' }); expect(details.exercises[0].exerciseNote).toBe('Seat 4');
  input.exercises[0].sets = []; expect(workoutHistoryDetails(input, new Map()).volumes).toEqual([]);
});
