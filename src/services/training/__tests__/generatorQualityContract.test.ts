import { assessQualityAxes, explainQualityFinding, GENERATOR_QUALITY_VERSION } from '../generatorQualityContract';

const confidence = { selectedExerciseIds: ['a'], missingCriteriaIds: [], unknownStimulusIds: ['a'],
  unverifiedResistanceIds: ['a'], individuallySourceReviewedIds: [] };

it('does not conflate feasibility with programming or scientific confidence', () => {
  const assessment = assessQualityAxes([{ code: 'underfilled-session', severity: 'warning', actual: 8, limit: 12 }], confidence);
  expect(assessment.version).toBe(GENERATOR_QUALITY_VERSION);
  expect(assessment.feasibility.status).toBe('feasible');
  expect(assessment.programming.status).toBe('review-required');
  expect(assessment.confidence.status).toBe('heuristic-limited');
  expect(assessment.programming.findings[0]).toMatchObject({ basis: 'programming-heuristic', magnitude: { actual: 8, limit: 12 } });
  expect(assessment.programming.findings[0].explanation).toContain('not a physiological minimum');
});

it('keeps missing data and infeasibility visible without granting a quality grade', () => {
  const result = assessQualityAxes([{ code: 'excluded-exercise', severity: 'error', actual: 1, limit: 0, subject: 'a' }], confidence);
  expect(result.feasibility.status).toBe('infeasible');
  expect(result.programming.status).toBe('not-assessable');
  expect(result.feasibility.findings[0].basis).toBe('product-constraint');
  expect(result.confidence.unknownStimulusIds).toEqual(['a']);
});

it('does not present an unflagged result as proven optimal', () => {
  const result = assessQualityAxes([], { ...confidence, selectedExerciseIds: [] });
  expect(result.programming.status).toBe('no-detected-issues');
  expect(result.programming.interpretation).toContain('not proof');
  expect(result.confidence.status).toBe('not-assessable');
});

it('preserves custom diagnostic explanations with a fallback for unknown codes', () => {
  expect(explainQualityFinding({ code: 'other', severity: 'warning', actual: 1, limit: 0, detail: 'Reason' }).explanation).toBe('Reason');
  expect(explainQualityFinding({ code: 'other', severity: 'warning', actual: 1, limit: 0 }).explanation).toContain('other');
});
