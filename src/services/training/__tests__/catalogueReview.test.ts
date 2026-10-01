import { EXERCISE_CATALOGUE } from '../exerciseCatalogue';
import { reviewCatalogueExercise } from '../catalogueReview';

it('keeps source-derived faults separate from unverified criterion claims without changing prescriptions', () => {
  const exercise = EXERCISE_CATALOGUE.find((e) => e.id === 'guide-347')!;
  const original = JSON.stringify(exercise);
  const review = reviewCatalogueExercise(exercise, {});
  expect(review.sourceFindings).toEqual([expect.objectContaining({ page: 347, code: 'equipment-mismatch' })]);
  expect(review.criteria.every((c) => c.supportVerified === false && c.provenance === 'generic-guide-rubric')).toBe(true);
  expect(JSON.stringify(exercise)).toBe(original);
});

it('does not equate a citation label with verified support or miss neural-fatigue claims', () => {
  const exercise = EXERCISE_CATALOGUE.find((e) => e.id === 'press-banca')!;
  const review = reviewCatalogueExercise(exercise, { [exercise.id]: { systemicFatigueCost: {
    confidence: 'direct-evidence', citations: ['PMID:example'], note: 'Fatiga del sistema nervioso',
  } } });
  expect(review.issues).toContain('citation-support-unverified:systemicFatigueCost');
  expect(review.issues).toContain('neural-fatigue-claim:systemicFatigueCost');
  expect(review.sourcePages).toContain(62);
});
it('distinguishes individual source mechanics from unresolved numeric rating approval', () => {
  const exercise = EXERCISE_CATALOGUE.find((e) => e.id === 'guide-214')!;
  const review = reviewCatalogueExercise(exercise, {});
  expect(review.status).toBe('source-mechanics-reviewed-rating-unresolved');
  expect(review.individualSource?.hybrid).toBe(true);
  expect(review.criterionBands?.resistanceProfileMatch).toBeNull();
  expect(review.criteria.every((criterion) => criterion.value === null && !criterion.supportVerified)).toBe(true);
  expect(reviewCatalogueExercise(EXERCISE_CATALOGUE.find((e) => e.id === 'guide-347')!, {}).status)
    .toBe('screened-needs-individual-verification');
});
