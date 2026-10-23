import { SetType, type WorkoutSession } from '@/models';
import { EXERCISE_CATALOGUE } from '../exerciseCatalogue';
import { workoutReview } from '../workoutReview';
const exercise = EXERCISE_CATALOGUE[0];
const set = (id: string, weight: number, reps: number, patch = {}) => ({ id, setType: SetType.NORMAL, targetWeight: 20, targetReps: 10, targetRIR: 2,
  isAutoFilled: false, actualWeight: weight, actualReps: reps, isCompleted: true, completionState: 'DONE' as const, ...patch });
const past = (sets: ReturnType<typeof set>[], patch = {}) => ({ id: 'past', completedAt: 1, exercises: [{ exerciseId: exercise.id, sets }], ...patch } as unknown as WorkoutSession);
const review = (sets: ReturnType<typeof set>[], history = [past([set('old', 20, 10)])]) => workoutReview([exercise], { [exercise.id]: sets }, history, 'current');
it('marks the exact improving set, not ties, warmups, partial reps or a first observation', () => {
  const rows = [set('tie', 20, 10), set('pr', 20, 11), set('repeat', 20, 11), set('w', 100, 20, { setType: SetType.WARMUP }), set('partial', 20, 10, { actualPartialReps: 20 })];
  expect(review(rows).recordSetIds).toEqual([`${exercise.id}:pr`]);
  expect(review(rows, []).records).toEqual([]);
  expect(review([set('heavier', 25, 10)]).records).toEqual([{ exerciseId: exercise.id, weight: 25, reps: 10 }]);
  expect(review([set('less-reps', 25, 8)]).recordSetIds).toEqual([`${exercise.id}:less-reps`]);
  expect(review([set('both-improve', 35, 12)]).recordSetIds).toEqual([`${exercise.id}:both-improve`]);
  expect(review([set('new-low-load', 10, 20)]).recordSetIds).toEqual([]);
});
it('does not compare pending, discarded, invalid, current or incompatible history', () => {
  for (const history of [[past([set('old', 20, 10)], { completedAt: undefined })], [past([set('old', 20, 10)], { discardedAt: 3 })],
    [past([set('old', NaN, 10)])], [past([set('old', 20, 10, { completionState: 'PENDING' })])],
    [past([set('old', 20, 10)], { id: 'current' })], [past([set('old', 20, 10, { recording: { measure: 'REPETITIONS', load: 'ASSISTED_KG' } })])]]) {
    expect(review([set('new', 30, 12)], history).recordSetIds).toEqual([]);
  }
  expect(review([set('invalid', Infinity, 10)]).records).toEqual([]);
});
