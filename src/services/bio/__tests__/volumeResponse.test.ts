import { SetType, type Mesocycle, type WorkoutSession } from '@/models';
import { EXERCISE_CATALOGUE } from '@/services/training/exerciseCatalogue';
import { buildBioCycles, createMicrocycleReview } from '../microcycleReview';
import { reviewVolumeResponse } from '../volumeResponse';
const exercise = EXERCISE_CATALOGUE[0], catalogue = new Map([[exercise.id, exercise]]), day = 86400000, now = 20 * day;
const plan: Mesocycle = { id: 'plan', userId: 'owner', status: 'ACTIVE', currentMicrocycleIndex: 1,
  sessionsPerMicrocycle: 1, targetVolumePerGroup: {}, startedAt: 1, updatedAt: 1, prescriptionMode: 'MANUAL',
  plannedSessions: [{ index: 0, focus: 'FULL_BODY', estimatedWorkMinutes: 10, exercises: [{ exerciseId: exercise.id, order: 0, isEdited: false,
    sets: [{ setType: SetType.NORMAL, targetReps: 10, targetRIR: 2 }] }] }] };
function setup(weights = [40, 41, 42, 50, 51, 52]) {
  const history: WorkoutSession[] = weights.map((weight, index) => ({ id: `workout${index}`, userId: 'owner', mesocycleId: 'plan',
    microcycleId: `m${index < 3 ? 0 : 1}`, microcycleIndex: index < 3 ? 0 : 1, plannedSessionIndex: 0,
    performedAt: (index * 2 + 1) * day, completedAt: (index * 2 + 1) * day + 60000,
    exercises: [{ id: 'entry', exerciseId: exercise.id, exerciseSnapshot: exercise, order: 0, isSwap: false,
      sets: [{ id: 'set', setType: SetType.NORMAL, targetReps: 10, targetWeight: 40, targetRIR: 2, isAutoFilled: false,
        actualWeight: weight, actualReps: 10, actualRIR: 2, actualRIRSource: 'ATHLETE', completionState: 'DONE' }] }] }));
  const reviews = buildBioCycles('owner', [plan], history, now).map((cycle) => createMicrocycleReview('owner', cycle,
    { recovery: 'USUAL', sustainability: 'YES', discomfort: 'NONE', unrecoveredMuscles: [] }, 'SUBMITTED', undefined, now));
  return { history, reviews, evaluate: () => reviewVolumeResponse('owner', plan, history, reviews, catalogue, now) };
}
it('maintains a tolerable dose with repeated observed progress and never mutates the prescription', () => {
  const input = setup(), before = JSON.stringify([plan, input.history, input.reviews]);
  expect(input.evaluate()[0]).toMatchObject({ muscle: exercise.primaryMuscle, reason: 'RECORDED_PROGRESS', action: 'MAINTAIN', observations: 6, cycleIndexes: [1, 0] });
  expect(JSON.stringify([plan, input.history, input.reviews])).toBe(before);
  expect(reviewVolumeResponse('other', plan, input.history, input.reviews, catalogue, now)).toEqual([]);
  expect(reviewVolumeResponse('owner', plan, input.history, input.reviews, catalogue, NaN)).toEqual([]);
  expect(reviewVolumeResponse('owner', plan, [], [], catalogue, now)).toEqual([]);
});
it.each([
  [[50, 51, 52, 40, 41, 42], 'LOWER_OBSERVATIONS', 'REVIEW'],
  [[40, 40, 40, 40, 40, 40], 'UNCHANGED_OBSERVATIONS', 'REVIEW'],
  [[40, 50, 42, 41, 51, 40], 'MIXED_OBSERVATIONS', 'KEEP_COLLECTING'],
])('reports exact repeated observations %j without diagnosing a plateau', (weights, reason, action) => {
  expect(setup(weights as number[]).evaluate()[0]).toMatchObject({ reason, action });
});
it('does not call missing feedback, inherited effort, or same-day repetitions good adaptation', () => {
  let input = setup(); input.reviews.splice(0); expect(input.evaluate()[0].reason).toBe('INSUFFICIENT');
  input = setup(); for (const review of input.reviews) delete review.answers.unrecoveredMuscles;
  expect(input.evaluate()[0].reason).toBe('INSUFFICIENT');
  input = setup(); for (const workout of input.history) workout.exercises[0].sets[0].actualRIRSource = 'INHERITED_TARGET';
  expect(input.evaluate()[0]).toMatchObject({ reason: 'INSUFFICIENT', observations: 0 });
  input = setup(); input.history[2].performedAt = input.history[1].performedAt; input.history[2].completedAt = input.history[1].completedAt;
  expect(input.evaluate()[0].reason).toBe('INSUFFICIENT');
  input = setup(); input.reviews[0].answers.context = ['STRESS']; expect(input.evaluate()[0].reason).toBe('INSUFFICIENT');
});
it('keeps discomfort separate from progress and reviews feasibility before prescribing more work', () => {
  let input = setup(); input.reviews[0].answers.discomfort = 'PRESENT';
  expect(input.evaluate()[0]).toMatchObject({ reason: 'DISCOMFORT', action: 'REVIEW' });
  input = setup(); input.reviews[0].answers.sustainability = 'TIGHT';
  expect(input.evaluate()[0]).toMatchObject({ reason: 'FEASIBILITY', action: 'REVIEW' });
  input = setup(); input.reviews[0].answers.context = ['TIME']; expect(input.evaluate()[0].reason).toBe('FEASIBILITY');
  input = setup(); input.reviews.forEach((review) => { review.answers.unrecoveredMuscles = [exercise.primaryMuscle]; });
  expect(input.evaluate()[0]).toMatchObject({ reason: 'REPEATED_LOCAL_RECOVERY', action: 'REVIEW' });
});
it('rejects stale/foreign/invalid reviews and preserves a genuinely unknown local answer', () => {
  const input = setup(); input.reviews[0].observedTo--;
  expect(input.evaluate()[0].reason).toBe('INSUFFICIENT');
  input.reviews[0].observedTo++; input.reviews[0].userId = 'other'; expect(input.evaluate()[0].reason).toBe('INSUFFICIENT');
  input.reviews[0].userId = 'owner'; input.reviews[0].questionnaireVersion = 99 as any; expect(input.evaluate()[0].reason).toBe('INSUFFICIENT');
});
