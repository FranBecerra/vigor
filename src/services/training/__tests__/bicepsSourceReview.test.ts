import { BICEPS_SOURCE_REVIEWS, bicepsSourceReview, bicepsSourceClassification, BICEPS_ELIGIBILITY } from '../bicepsSourceReview';
import { ExerciseGenerationTier, ExerciseProfile, MuscleGroup } from '@/models';
import { reviewedExerciseMetadata } from '../exerciseMetadataReview';
import { EXERCISE_CATALOGUE } from '../exerciseCatalogue';
import { reviewCatalogueExercise } from '../catalogueReview';

it('records the individually read pages with explicit setup and unresolved ratings', () => {
  expect(BICEPS_SOURCE_REVIEWS.map((entry) => entry.page)).toEqual(Array.from({ length: 28 }, (_, index) => 233 + index));
  expect(BICEPS_SOURCE_REVIEWS.every((entry) => entry.setup.length > 30 && entry.unresolved.length > 30)).toBe(true);
  expect(bicepsSourceReview(232)).toBeUndefined();
  expect(bicepsSourceReview(NaN)).toBeUndefined();
  expect(bicepsSourceReview(239)?.support).toBe('BACKREST');
  expect(bicepsSourceReview(241)?.unresolved).toContain('Cam');
});
it('does not modify original exercise scores, eligibility or generic Bayesian setup', () => {
  const exercise = EXERCISE_CATALOGUE.find((entry) => entry.id === 'curl-bayesian')!;
  const before = JSON.stringify(exercise);
  const result = reviewCatalogueExercise(exercise, {});
  expect(result.bicepsSource).toBeUndefined();
  expect(result.relatedSourcePages).toEqual([239, 259]);
  expect(result.sourceRelation).toBe('related-variant');
  expect(result.status).toBe('related-variant-rating-unresolved');
  expect(result.criteria.every((entry) => !entry.supportVerified)).toBe(true);
  expect(JSON.stringify(exercise)).toBe(before);
});

it('classifies every source page without assigning unsupported curves or numeric ratings', () => {
  for (const review of BICEPS_SOURCE_REVIEWS) {
    const exercise = EXERCISE_CATALOGUE.find((entry) => entry.guidePage === review.page);
    if (!exercise) continue;
    const { stimulusTags, ...classification } = bicepsSourceClassification(review);
    expect(exercise).toMatchObject(classification);
    expect(exercise.stimulusTags).toEqual(expect.arrayContaining(stimulusTags));
    expect(exercise.criteria).toBeUndefined();
    expect(exercise.generationTier).toBe(ExerciseGenerationTier.MANUAL_ONLY);
    expect(reviewedExerciseMetadata(exercise).sourceReview?.page).toBe(review.page);
    expect(exercise.stimulusTags?.some((tag) => tag.startsWith('RESISTANCE:'))).toBe(false);
  }
});

it('preserves distinct Bayesian identities and corrects misleading names without deleting saved IDs', () => {
  const at = (id: string) => EXERCISE_CATALOGUE.find((entry) => entry.id === id)!;
  expect(at('curl-bayesian').guidePage).toBeUndefined();
  expect(at('guide-239').stimulusTags).toContain('SUPPORT:BACKREST');
  expect(at('guide-259').stimulusTags).toContain('LATERALITY:UNILATERAL');
  expect(at('guide-254').stimulusTags).toContain('GRIP:SUPINATED');
  expect(at('guide-248').stimulusTags).toContain('SUPPORT:NONE');
  expect(at('guide-247').stimulusTags).toContain('SHOULDER:EXTENDED');
  for (const id of ['guide-249', 'guide-256']) expect(at(id).stimulusTags).toContain('SHOULDER:ABDUCTED');
  expect(at('guide-237').profile).toBe(ExerciseProfile.COMPOUND_SECONDARY);
  expect(at('guide-237').secondaryMuscles).toEqual([]);
});

it('records explicit eligibility for every biceps entry without promoting unscored imports', () => {
  const exercises = EXERCISE_CATALOGUE.filter((entry) => entry.primaryMuscle === MuscleGroup.BICEPS);
  expect(Object.keys(BICEPS_ELIGIBILITY).sort()).toEqual(exercises.map((entry) => entry.id).sort());
  for (const exercise of exercises) {
    expect(exercise.generationTier).toBe(BICEPS_ELIGIBILITY[exercise.id].tier);
    expect(BICEPS_ELIGIBILITY[exercise.id].reason.length).toBeGreaterThan(20);
  }
});
