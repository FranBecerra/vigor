import { Equipment, ExerciseGenerationTier, ExerciseProfile, MovementVector, MuscleGroup } from '@/models';
import { EXERCISE_CATALOGUE, filterCatalogue } from '../exerciseCatalogue';
import { guideExerciseId, GUIDE_EXISTING_IDS } from '../guideExerciseCatalogue';
import { TRICEPS_SOURCE_REVIEWS, tricepsSourceClassification, tricepsCriterionBands, tricepsSourceReview,
  REVIEWED_TRICEPS_CRITERIA, TRICEPS_ELIGIBILITY } from '../tricepsSourceReview';
import { reviewedExerciseMetadata } from '../exerciseMetadataReview';
import evidenceData from '@/data/exercise-evidence.json';

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
      expect(exercise.criteria).toEqual(REVIEWED_TRICEPS_CRITERIA[entry.page]);
      expect(exercise.generationTier).toBe(TRICEPS_ELIGIBILITY[exercise.id].tier);
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

it('records an individual automatic-programming decision for every triceps-primary entry', () => {
  const triceps = EXERCISE_CATALOGUE.filter((e) => e.primaryMuscle === MuscleGroup.TRICEPS);
  expect(Object.keys(TRICEPS_ELIGIBILITY).sort()).toEqual(triceps.map((e) => e.id).sort());
  for (const exercise of triceps) {
    const decision = TRICEPS_ELIGIBILITY[exercise.id];
    expect(exercise.generationTier ?? ExerciseGenerationTier.STANDARD).toBe(decision.tier);
    expect(decision.reason.length).toBeGreaterThan(15);
    if (decision.tier !== ExerciseGenerationTier.MANUAL_ONLY) expect(exercise.criteria).toBeDefined();
  }
  // Individual scores alone do not promote: the rejected experiment keeps guide-199 manual.
  const lyingDumbbell = triceps.find((e) => e.id === 'guide-199')!;
  expect(lyingDumbbell.criteria).toEqual(REVIEWED_TRICEPS_CRITERIA[199]);
  expect(lyingDumbbell.generationTier).toBe(ExerciseGenerationTier.MANUAL_ONLY);
});

it('keeps the corrected triceps ratings and roles', () => {
  const at = (id: string) => EXERCISE_CATALOGUE.find((e) => e.id === id)!;
  for (const e of EXERCISE_CATALOGUE.filter((x) => x.primaryMuscle === MuscleGroup.TRICEPS && x.criteria)) {
    expect(e.criteria!.resistanceProfileMatch).toBeLessThan(5);
  }
  // Neither press lengthens the long head: the shoulder is extended, not flexed.
  expect(at('press-banca-cerrado').criteria!.stretchedPositionLoading).toBe(2);
  expect(at('fondos-banco')).toMatchObject({ profile: ExerciseProfile.COMPOUND_SECONDARY,
    movementVector: MovementVector.ELBOW_EXTENSION, generationTier: ExerciseGenerationTier.FALLBACK });
  expect(at('fondos-banco').criteria!.stretchedPositionLoading).toBe(2);
  // Same cable stack, same elbow excursion.
  expect(at('pushdown-cuerda').criteria!.loadProgressability).toBe(at('pushdown-barra').criteria!.loadProgressability);
  expect(at('pushdown-cuerda').criteria!.rangeOfMotion).toBe(at('pushdown-barra').criteria!.rangeOfMotion);
});

it('cites triceps trials only for what they measured', () => {
  const evidence = (evidenceData as { evidence: Record<string, Record<string, { confidence: string; citations: string[] }>> }).evidence;
  for (const id of Object.keys(TRICEPS_ELIGIBILITY)) {
    for (const [criterion, entry] of Object.entries(evidence[id] ?? {})) {
      // Maeo 2023 and Brandao 2020 measured growth by position and exercise, not profiles, ROM or fatigue.
      if (entry.confidence === 'direct-evidence') expect(criterion).toBe('stretchedPositionLoading');
      expect(entry.citations).not.toEqual(expect.arrayContaining(['PMID:32922646']));
      expect(entry.citations).not.toEqual(expect.arrayContaining(['PMID:21858666']));
      expect(entry.citations).not.toEqual(expect.arrayContaining(['PMID:23657165']));
    }
  }
});
