import { ExperienceLevel, MuscleGroup, SplitStructure } from '@/models';
import { EXERCISE_CATALOGUE } from '../exerciseCatalogue';
import { splitAdherence } from '../splitAdherence';
import { recommendCapacity, generateFromCapacityRecommendation } from '../capacityRecommendation';
import { TrainingGoal, VolumeRegion } from '../volumePlan';
import { toPlannedSessions } from '../routineMapper';

it('distinguishes small supplements from a disguised full-body split, without counting core as spillover', () => {
  const exercise = EXERCISE_CATALOGUE[0];
  const distribution = { requestedSplit: SplitStructure.UPPER_LOWER, sessions: [{ index: 0, focus: 'LOWER' as const, estimatedWorkMinutes: 40,
    exercises: [{ exercise: { ...exercise, primaryMuscle: MuscleGroup.QUADS }, sets: 9 }, { exercise, sets: 3 }] }] };
  expect(splitAdherence(distribution)).toMatchObject({ light: true, sessions: [{ sets: 3, total: 12 }] });
  expect(splitAdherence({ ...distribution, sessions: [{ ...distribution.sessions[0], exercises: distribution.sessions[0].exercises.map((entry) => ({ ...entry, sets: 3 })) }] }).light).toBe(false);
  expect(splitAdherence({ ...distribution, requestedSplit: SplitStructure.AUTO }).sessions).toEqual([]);
  expect(splitAdherence({ ...distribution, sessions: [{ ...distribution.sessions[0], exercises: [{ exercise: { ...exercise, primaryMuscle: MuscleGroup.CORE }, sets: 3 }] }] }).light).toBe(true);
});
it.each(Object.values(ExperienceLevel))('retains the explicit upper/lower sequence for %s in Decide for me and keeps the intended preview labels', (level) => {
  const input = { level, goal: TrainingGoal.HYPERTROPHY, split: SplitStructure.UPPER_LOWER,
    priorityRegions: [VolumeRegion.BACK, VolumeRegion.TRICEPS], catalogue: EXERCISE_CATALOGUE };
  const recommendation = recommendCapacity(input);
  const plan = generateFromCapacityRecommendation({ ...input, capacity: recommendation, seed: 4 }, recommendation)!;
  expect(plan.distribution.sessions.map((session) => session.focus)).toEqual(plan.distribution.sessions.map((_, index) => index % 2 ? 'LOWER' : 'UPPER'));
  expect(toPlannedSessions(plan, false, { preserveFocus: true }).map((session) => session.focus)).toEqual(plan.distribution.sessions.map((session) => session.focus));
  expect(recommendation.reachesRecoverableVolume).toBe(true);
});
