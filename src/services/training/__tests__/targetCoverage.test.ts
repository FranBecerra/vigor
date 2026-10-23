import { ExperienceLevel, ExerciseGenerationTier, MuscleGroup, MovementVector } from '@/models';
import { EXERCISE_CATALOGUE } from '../exerciseCatalogue';
import { selectExercises, summarizeSelection } from '../exerciseSelection';
import { completeTargetCoverage, missingRequiredPatterns } from '../targetCoverage';
import { buildVolumePlan, TrainingGoal, VolumeRegion } from '../volumePlan';

it.each(Object.values(ExperienceLevel))('covers back-priority targets without raising ceilings or losing vertical pulling: %s', (level) => {
  const plan = buildVolumePlan({ level, goal: TrainingGoal.HYPERTROPHY, priorityRegions: [VolumeRegion.BACK] });
  for (const seed of [11, 22, 33]) {
    const selected = selectExercises({ volumePlan: plan, catalogue: EXERCISE_CATALOGUE, seed, rankingPolicy: 'accessory-aware' });
    const copy = JSON.stringify(selected);
    const result = completeTargetCoverage(selected, plan, EXERCISE_CATALOGUE);
    expect(JSON.stringify(selected)).toBe(copy);
    expect(result.selected.some((entry) => entry.exercise.movementVector === MovementVector.PULL_VERTICAL)).toBe(true);
    expect(missingRequiredPatterns(result, plan)).toEqual([]);
    for (const target of plan.muscles) expect(result.attributedByMuscle[target.muscle] ?? 0).toBeGreaterThanOrEqual(target.meav - 1);
    expect(result.selected.every((entry) => entry.sets >= 2 && entry.sets <= 4)).toBe(true);
  }
});
it('does not invent coverage for an empty or manually restricted catalogue', () => {
  const plan = buildVolumePlan({ level: ExperienceLevel.INTERMEDIATE, goal: TrainingGoal.HYPERTROPHY });
  const empty = summarizeSelection([], plan, []);
  const result = completeTargetCoverage(empty, plan, [{ ...EXERCISE_CATALOGUE[0], generationTier: ExerciseGenerationTier.MANUAL_ONLY }]);
  expect(result.selected).toEqual([]); expect(missingRequiredPatterns(result, plan)).toContain(MovementVector.PULL_VERTICAL);
  expect(completeTargetCoverage(empty, { ...plan, muscles: [] }, []).selected).toEqual([]);
});
it('derives missing patterns from actual identities instead of stale inherited diagnostics', () => {
  const plan = buildVolumePlan({ level: ExperienceLevel.INTERMEDIATE, goal: TrainingGoal.HYPERTROPHY, trainedRegions: [VolumeRegion.BACK] });
  const row = EXERCISE_CATALOGUE.find((exercise) => exercise.movementVector === MovementVector.PULL_HORIZONTAL)!;
  const stale = summarizeSelection([{ exercise: row, sets: 4 }], plan, []);
  expect(missingRequiredPatterns(stale, plan)).toContain(MovementVector.PULL_VERTICAL);
  expect(plan.muscles.find((target) => target.muscle === MuscleGroup.LATS)?.meav).toBeGreaterThan(0);
});
