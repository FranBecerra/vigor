import { BICEPS_SOURCE_REVIEWS, bicepsSourceReview } from '../bicepsSourceReview';
import { EXERCISE_CATALOGUE } from '../exerciseCatalogue';
import { reviewCatalogueExercise } from '../catalogueReview';

it('records the individually read pages with explicit setup and unresolved ratings', () => {
  expect(BICEPS_SOURCE_REVIEWS.map((entry) => entry.page)).toEqual([233, 234, 235, 236, 237, 238, 239, 240, 241, 242, 243, 244, 250]);
  expect(BICEPS_SOURCE_REVIEWS.every((entry) => entry.setup.length > 30 && entry.unresolved.length > 30)).toBe(true);
  expect(bicepsSourceReview(245)).toBeUndefined();
  expect(bicepsSourceReview(239)?.support).toBe('BACKREST');
  expect(bicepsSourceReview(241)?.unresolved).toContain('Cam');
});
it('does not modify original exercise scores, eligibility or generic Bayesian setup', () => {
  const exercise = EXERCISE_CATALOGUE.find((entry) => entry.id === 'curl-bayesian')!;
  const before = JSON.stringify(exercise);
  const result = reviewCatalogueExercise(exercise, {});
  expect(result.bicepsSource?.page).toBe(239);
  expect(result.bicepsSource?.unresolved).toContain('Generic standing Bayesian');
  expect(result.status).toBe('source-mechanics-reviewed-rating-unresolved');
  expect(result.criteria.every((entry) => !entry.supportVerified)).toBe(true);
  expect(JSON.stringify(exercise)).toBe(before);
});
