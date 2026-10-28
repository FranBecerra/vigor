import { SetType, type PlannedSession } from '@/models';
import { EXERCISE_CATALOGUE } from '../exerciseCatalogue';
import { hasWorkoutPlanChanges, moveItem, prescriptionFromWorkout, workoutPlanChanges } from '../workoutReview';
import type { SessionSetState } from '../sessionMapper';
const [a, b] = EXERCISE_CATALOGUE;
const row: SessionSetState = { id: 'row', setType: SetType.NORMAL, targetWeight: 30, targetReps: 10, targetRIR: 2, isAutoFilled: false, isCompleted: false };
const base: PlannedSession = { index: 0, focus: 'UPPER', estimatedWorkMinutes: 10, exercises: [{ exerciseId: a.id, exerciseSnapshot: a, order: 0, sets: [{ ...row, targetRepsMin: 8 }], isEdited: false }] };
it('moves only valid positions without mutating exercise identities', () => {
  const source = [a, b]; expect(moveItem(source, 0, 1)).toEqual([b, a]); expect(source).toEqual([a, b]);
  for (const [from, to] of [[-1, 0], [0, -1], [2, 0], [0, 2], [0.5, 1], [0, NaN]]) expect(moveItem(source, from, to)).toEqual(source);
});
it('lists precise dose edits but not achieved kg or RIR that will not be applied', () => {
  expect(workoutPlanChanges(base, [a], { [a.id]: [{ ...row, actualWeight: 99, actualRIR: 0 }] })).toEqual([]);
  const rows = [{ ...row, setType: SetType.FAILURE, actualReps: 8 }, { ...row, id: 'new' }];
  expect(workoutPlanChanges(base, [a], { [a.id]: rows })).toMatchObject([
    { kind: 'sets', before: 1, after: 2 }, { kind: 'type', set: 1, before: SetType.NORMAL, after: SetType.FAILURE },
  ]);
  expect(hasWorkoutPlanChanges(base, [a], { [a.id]: rows })).toBe(true);
  expect(prescriptionFromWorkout(base, [a], { [a.id]: rows }).exercises[0].sets[0]).toMatchObject({ targetReps: 10, targetRIR: 2 });
});
it('lists substitutions and removals, including legacy plans without snapshots', () => {
  expect(workoutPlanChanges(base, [b], { [b.id]: [row] }).map((item) => item.kind)).toEqual(['removed', 'added']);
  expect(hasWorkoutPlanChanges({ ...base, exercises: [{ ...base.exercises[0], exerciseSnapshot: undefined }] }, [], {})).toBe(true);
  expect(workoutPlanChanges(base, [a], {}).map((item) => item.kind)).toEqual(['sets']);
});
it('describes exercise reordering without inventing dose edits', () => {
  const both = { ...base, exercises: [...base.exercises, { ...base.exercises[0], exerciseId: b.id, exerciseSnapshot: b, order: 1 }] };
  expect(workoutPlanChanges(both, [b, a], { [a.id]: [row], [b.id]: [row] })).toMatchObject([{ kind: 'order', before: 2, after: 1 }, { kind: 'order', before: 1, after: 2 }]);
});
it('separates added warmups from working prescription and keeps per-set RIR aligned', () => {
  const prescription = { ...base, exercises: [{ ...base.exercises[0], sets: [{ setType: SetType.NORMAL, targetReps: 10, targetRIR: 3 }, { setType: SetType.NORMAL, targetReps: 8, targetRIR: 2 }] }] };
  const rows = [{ ...row, id: 'warm', setType: SetType.WARMUP, targetReps: 5, targetRIR: 4, targetWeight: 15 }, { ...row, targetRIR: 3 }, { ...row, id: 'second', targetReps: 8, targetRIR: 2 }];
  expect(workoutPlanChanges(prescription, [a], { [a.id]: rows })).toMatchObject([{ kind: 'warmups', before: 0, after: 1 }]);
  const result = prescriptionFromWorkout(prescription, [a], { [a.id]: rows });
  expect(result.exercises[0].sets.map((set) => set.targetRIR)).toEqual([4, 3, 2]);
  expect(result.exercises[0].sets[0].targetWeightKg).toBe(15);
});
