import { EXERCISE_CATALOGUE } from '../exerciseCatalogue';
import { catalogueWithReviewedTags, reviewedExerciseMetadata } from '../exerciseMetadataReview';
import { allocateExerciseVolume, selectExercises } from '../exerciseSelection';
import { buildVolumePlan, TrainingGoal } from '../volumePlan';
import { ExperienceLevel } from '@/models';

it('adds only explicit geometry and keeps resistance curves unverified', () => {
  const bench = EXERCISE_CATALOGUE.find((e) => e.id === 'press-banca')!;
  expect(reviewedExerciseMetadata(bench)).toMatchObject({ descriptiveTags: ['PRESS_ANGLE:HORIZONTAL'],
    source: 'explicit-exercise-description', resistanceProfile: 'unverified' });
  const variant = { ...bench, id: 'unknown-custom' };
  expect(reviewedExerciseMetadata(variant).source).toBe('unreviewed');
  const tagged = { ...bench, stimulusTags: ['PRESS_ANGLE:OTHER'] };
  const result = catalogueWithReviewedTags([bench, variant, tagged]);
  expect(result[0].stimulusTags).toEqual(['PRESS_ANGLE:HORIZONTAL']);
  expect(result[1]).toBe(variant);
  expect(result[2]).toBe(tagged);
  expect(bench.stimulusTags).toBeUndefined();
});

it('allocates dose independently while preserving roster identity and input data', () => {
  const volumePlan = buildVolumePlan({ level: ExperienceLevel.INTERMEDIATE, goal: TrainingGoal.HYPERTROPHY });
  const result = selectExercises({ volumePlan, catalogue: EXERCISE_CATALOGUE, seed: 4 });
  const snapshot = JSON.stringify(result.selected);
  const allocated = allocateExerciseVolume(result.selected, { volumePlan });
  expect(allocated.selected.map((e) => e.exercise.id)).toEqual(result.selected.map((e) => e.exercise.id));
  expect(JSON.stringify(result.selected)).toBe(snapshot);
  expect(allocateExerciseVolume([], { volumePlan }).performedSets).toBe(0);
});
