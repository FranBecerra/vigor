import { SetType, type PlannedSession } from '@/models';
import { progressionChanges } from '../progressionChanges';

const session: PlannedSession = { index: 0, focus: 'UPPER', estimatedWorkMinutes: 15, exercises: [0, 1].map(order => ({
  exerciseId: `exercise-${order}`, order, isEdited: false, sets: [0, 1].map(() => ({ setType: SetType.NORMAL, targetReps: 10, targetRIR: 2 })),
})) };
it('omits unchanged cycles, exercises and set values without altering either payload', () => {
  const baseline = [0, 1, 2].map(index => ({ index, session }));
  const proposed = baseline.map(step => step.index !== 1 ? step : { ...step, session: { ...session, exercises: session.exercises.map((exercise, index) => index ? exercise : {
    ...exercise, sets: exercise.sets.map((set, position) => position ? set : { ...set, targetRIR: 3, targetWeightKg: 0 }),
  }) } });
  const signature = JSON.stringify([baseline, proposed]);
  expect(progressionChanges(proposed, baseline)).toEqual([{ index: 1, isDeload: undefined, exercises: [{ exerciseId: 'exercise-0',
    snapshot: undefined, kind: 'updated', details: [], sets: [{ index: 0, kind: 'updated', fields: [
      { field: 'targetRIR', from: 2, to: 3 }, { field: 'targetWeightKg', from: undefined, to: 0 },
    ] }] }] }]);
  expect(JSON.stringify([baseline, proposed])).toBe(signature);
  expect(progressionChanges(baseline, baseline)).toEqual([]);
});
it('detects added/removed sets and semantic rep ranges while preserving deload identity', () => {
  const before = { index: 5, isDeload: true, session };
  const removed = { ...before, session: { ...session, exercises: [{ ...session.exercises[0], sets: [session.exercises[0].sets[0]] }] } };
  const result = progressionChanges([removed], [before])[0];
  expect(result.isDeload).toBe(true);
  expect(result.exercises[0].sets[0]).toMatchObject({ index: 1, kind: 'removed' });
  expect(result.exercises[1].kind).toBe('removed');
  expect(progressionChanges([before], [removed])[0].exercises[0].sets[0].kind).toBe('added');
  const equivalent = { ...before, session: { ...session, exercises: session.exercises.map(exercise => ({ ...exercise, sets: exercise.sets.map(set => ({ ...set, targetRepsMin: 10 })) })) } };
  expect(progressionChanges([equivalent], [before])).toEqual([]);
});
