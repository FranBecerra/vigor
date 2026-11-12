import { SetType } from '@/models';
import { hybridFixture } from '@/test-support/hybridFixture';
import { toRoutineView } from '@/services/training/routineView';
import { groupedReviewSets, matchingStrengthSession } from '../combinedCycleReview';
it('resolves the matching strength placement and rejects absent, foreign or changed context', () => {
  const f = hybridFixture(), view = toRoutineView(f.draft.routine, f.draft.mesocycle, f.exercises, f.labels)!;
  const placement = f.input.strength[0];
  expect(matchingStrengthSession(placement, view)).toBe(view.microcycles[0].sessions[0]);
  expect(matchingStrengthSession(placement)).toBeNull();
  expect(matchingStrengthSession(placement, { ...view, microcycles: [] })).toBeNull();
  for (const patch of [{ id: 'foreign:0' }, { name: 'changed' }, { estimatedMinutes: 0 }, { lowerBodyDemand: 'HIGH' as const }]) {
    expect(matchingStrengthSession({ ...placement, ...patch }, view)).toBeNull();
  }
});
it('groups consecutive equal sets but preserves mixed reps, RIR, types and repeated non-adjacent doses', () => {
  const normal = { setType: SetType.NORMAL, targetReps: 10, targetRepsMin: 8, targetRIR: 2 };
  const rows = groupedReviewSets({ repRange: '10', sets: [normal, normal, { ...normal, targetReps: 8, targetRIR: 1 },
    { ...normal, setType: SetType.FAILURE, targetRIR: 0 }, normal, { ...normal, targetRepsMin: 10 },
    { ...normal, targetRepsMin: undefined }, { ...normal, targetRIR: undefined }] });
  expect(rows).toEqual([
    { count: 2, reps: '8–10', rir: 2, type: SetType.NORMAL }, { count: 1, reps: '8', rir: 1, type: SetType.NORMAL },
    { count: 1, reps: '8–10', rir: 0, type: SetType.FAILURE }, { count: 1, reps: '8–10', rir: 2, type: SetType.NORMAL },
    { count: 2, reps: '10', rir: 2, type: SetType.NORMAL }, { count: 1, reps: '8–10', rir: undefined, type: SetType.NORMAL },
  ]);
});
it('handles empty, legacy, timed and warmup prescriptions without inventing effort', () => {
  expect(groupedReviewSets({ sets: [], repRange: '10' })).toEqual([]);
  expect(groupedReviewSets({ repRange: '6–8', sets: [{ setType: SetType.NORMAL }] })).toEqual([{ count: 1, reps: '6–8', rir: undefined, type: SetType.NORMAL }]);
  const timed = { setType: SetType.NORMAL, targetDurationSeconds: 30, targetRIR: 3 };
  expect(groupedReviewSets({ repRange: '', sets: [timed, timed, { setType: SetType.WARMUP, targetReps: 5, targetRIR: 5 }] })).toEqual([
    { count: 2, reps: '30s', rir: undefined, type: SetType.NORMAL }, { count: 1, reps: '5', rir: undefined, type: SetType.WARMUP },
  ]);
});
