import { ExperienceLevel, MovementVector } from '@/models';
import { EXERCISE_CATALOGUE } from '../exerciseCatalogue';
import { recommendCapacity, generateFromCapacityRecommendation } from '../capacityRecommendation';
import { TrainingGoal, VolumeRegion } from '../volumePlan';
import { SESSION_OVERHEAD_MINUTES } from '../sessionDuration';

it.each(Object.values(ExperienceLevel))('keeps Auto targets, real duration and pulling variety through ten generated seeds: %s', (level) => {
  const input = { level, goal: TrainingGoal.HYPERTROPHY, catalogue: EXERCISE_CATALOGUE, priorityRegions: [VolumeRegion.BACK] };
  const recommendation = recommendCapacity(input);
  expect(recommendation.preparedPlan).toBeDefined();
  const before = JSON.stringify(recommendation);
  for (let seed = 0; seed < 10; seed++) {
    const plan = generateFromCapacityRecommendation({ ...input, seed, capacity: recommendation }, recommendation)!;
    expect(plan).not.toBeNull(); expect(plan.selection.performedSets).toBe(recommendation.sets);
    for (const target of plan.uncappedPlan.muscles) expect(plan.selection.attributedByMuscle[target.muscle] ?? 0).toBeGreaterThanOrEqual(target.meav - 1);
    expect(plan.selection.selected.some((entry) => entry.exercise.movementVector === MovementVector.PULL_VERTICAL)).toBe(true);
    expect(plan.selection.selected.some((entry) => entry.exercise.movementVector === MovementVector.PULL_HORIZONTAL)).toBe(true);
    expect(plan.distribution.unassigned).toEqual([]);
    expect(plan.distribution.sessions.every((session) => session.exercises.length && session.estimatedWorkMinutes + SESSION_OVERHEAD_MINUTES <= recommendation.minutesPerSession + 0.01)).toBe(true);
  }
  expect(JSON.stringify(recommendation)).toBe(before);
});
it('never reuses an allocation after goal, time, catalogue or target edits', () => {
  const input = { level: ExperienceLevel.INTERMEDIATE, goal: TrainingGoal.HYPERTROPHY, catalogue: EXERCISE_CATALOGUE };
  const recommendation = recommendCapacity(input); const request = { ...input, seed: 1, capacity: recommendation };
  expect(generateFromCapacityRecommendation(request, null)).toBeNull();
  expect(generateFromCapacityRecommendation({ ...request, catalogue: [] }, recommendation)).toBeNull();
  expect(generateFromCapacityRecommendation({ ...request, priorityRegions: [VolumeRegion.BACK] }, recommendation)).toBeNull();
  expect(generateFromCapacityRecommendation({ ...request, capacity: { ...recommendation, minutesPerSession: 1 } }, recommendation)).toBeNull();
  expect(generateFromCapacityRecommendation({ ...request, goal: TrainingGoal.STRENGTH }, recommendation)).toBeNull();
});
it.each(Object.values(ExperienceLevel))('finds feasible arm-priority targets within the unchanged level-wide ceiling: %s', (level) => {
  const input = { level, goal: TrainingGoal.HYPERTROPHY, catalogue: EXERCISE_CATALOGUE, priorityRegions: [VolumeRegion.BICEPS] };
  const recommendation = recommendCapacity(input);
  expect(recommendation.reachesRecoverableVolume).toBe(true);
  expect(generateFromCapacityRecommendation({ ...input, capacity: recommendation, seed: 11 }, recommendation)?.selection.performedSets).toBe(recommendation.sets);
});
