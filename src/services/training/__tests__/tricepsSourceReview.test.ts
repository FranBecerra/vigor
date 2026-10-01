import { Equipment, ExerciseGenerationTier, ExerciseProfile, MovementVector, MuscleGroup } from '@/models';
import { EXERCISE_CATALOGUE, filterCatalogue } from '../exerciseCatalogue';
import { guideExerciseId, GUIDE_EXISTING_IDS } from '../guideExerciseCatalogue';
import { TRICEPS_SOURCE_REVIEWS, tricepsSourceClassification, tricepsCriterionBands, tricepsSourceReview } from '../tricepsSourceReview';
import { reviewedExerciseMetadata } from '../exerciseMetadataReview';

it('covers all 35 triceps source pages exactly once with individual setup and uncertainty', () => {
  expect(TRICEPS_SOURCE_REVIEWS.map((r) => r.page)).toEqual(Array.from({ length: 35 }, (_, i) => 197 + i));
  for (const entry of TRICEPS_SOURCE_REVIEWS) {
    const exercise = EXERCISE_CATALOGUE.find((e) => e.id === guideExerciseId({ page: entry.page, name: 'unused' }))!;
    expect(exercise.primaryMuscle).toBe(MuscleGroup.TRICEPS);
    expect(entry.setup.length).toBeGreaterThan(20);
    expect(entry.uncertainty.length).toBeGreaterThan(20);
    const bands = tricepsCriterionBands(entry);
    expect(bands.resistanceProfileMatch).toBeNull();
    for (const band of Object.values(bands)) if (band) {
      expect(band[0]).toBeGreaterThanOrEqual(1);
      expect(band[1]).toBeLessThanOrEqual(5);
      expect(band[0]).toBeLessThanOrEqual(band[1]);
    }
    expect(reviewedExerciseMetadata(exercise).sourceReview?.page).toBe(entry.page);
    if (!GUIDE_EXISTING_IDS[entry.page]) {
      const { stimulusTags, ...classification } = tricepsSourceClassification(entry);
      expect(exercise).toMatchObject(classification);
      expect(exercise.stimulusTags).toEqual(expect.arrayContaining(stimulusTags));
      expect(exercise.criteria).toBeUndefined();
      expect(exercise.generationTier).toBe(ExerciseGenerationTier.MANUAL_ONLY);
    }
  }
  expect(tricepsSourceReview(196)).toBeUndefined();
  expect(tricepsSourceReview(NaN)).toBeUndefined();
});

it('corrects cable and hybrid classifications without turning local hybrids into basic presses', () => {
  const at = (page: number) => EXERCISE_CATALOGUE.find((e) => e.id === `guide-${page}`)!;
  expect(at(209).equipment).toBe(Equipment.CABLE);
  expect(at(217).profile).toBe(ExerciseProfile.ISOLATION);
  for (const page of [210, 211, 214, 215, 231]) {
    expect(at(page)).toMatchObject({ profile: ExerciseProfile.COMPOUND_SECONDARY, movementVector: MovementVector.ELBOW_EXTENSION });
  }
  expect(at(203).movementVector).toBe(MovementVector.PUSH_HORIZONTAL);
  expect(filterCatalogue([at(209)], { availableEquipment: [Equipment.DUMBBELL] })).toEqual([]);
});

it('preserves the disputed high-cable description separately without renaming saved overhead IDs', () => {
  expect(guideExerciseId({ page: 212, name: 'unused' })).toBe('guide-212');
  const original = EXERCISE_CATALOGUE.find((e) => e.id === 'extension-sobre-cabeza-polea')!;
  expect(original.stimulusTags).toContain('SHOULDER:OVERHEAD');
  expect(tricepsSourceReview(212)?.uncertainty).toContain('Figure');
  expect(new Set(EXERCISE_CATALOGUE.map((e) => e.id)).size).toBe(EXERCISE_CATALOGUE.length);
});
