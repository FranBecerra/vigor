import { ExerciseGenerationTier, ExerciseProfile, MovementVector, MuscleGroup, type Exercise } from '@/models';
import { EXERCISE_CATALOGUE } from '../exerciseCatalogue';
import { generationCandidates, selectExercises } from '../exerciseSelection';
import { buildVolumePlan, TrainingGoal } from '../volumePlan';
import { ExperienceLevel } from '@/models/athlete';

const machine = EXERCISE_CATALOGUE.find((e) => e.id === 'abduccion-cadera-maquina')!;
const band = EXERCISE_CATALOGUE.find((e) => e.id === 'abduccion-cadera-banda')!;
const pool = (alternative: Exercise = machine, candidate: Exercise = band) => generationCandidates([candidate, alternative], TrainingGoal.HYPERTROPHY);

it('does not buy redundant poorly progressable variety, across seeds and active ranking policies', () => {
  expect(pool()).toEqual([machine]);
  const plan = buildVolumePlan({ level: ExperienceLevel.INTERMEDIATE, goal: TrainingGoal.HYPERTROPHY });
  const volumePlan = { ...plan, muscles: plan.muscles.filter((m) => m.muscle === MuscleGroup.GLUTES).map((m) => ({ ...m, meav: 8 })) };
  const before = JSON.stringify([machine, band, volumePlan]);
  for (const rankingPolicy of ['legacy-weighted', 'volume-aware', 'accessory-aware', 'ordinal'] as const) {
    for (const seed of [0, 1, 4, 31]) {
      const result = selectExercises({ catalogue: [machine, band], volumePlan, seed, rankingPolicy });
      expect(result.selected.map((entry) => entry.exercise.id)).toEqual([machine.id]);
      expect(result.selected[0].sets).toBeLessThanOrEqual(4);
    }
  }
  expect(JSON.stringify([machine, band, volumePlan])).toBe(before);
});

it('retains equipment/veto-limited fallbacks and leaves strength policy unchanged', () => {
  expect(generationCandidates([band], TrainingGoal.HYPERTROPHY)).toEqual([band]);
  expect(generationCandidates([], TrainingGoal.HYPERTROPHY)).toEqual([]);
  expect(generationCandidates([band, machine], TrainingGoal.STRENGTH)).toEqual([band, machine]);
  for (const generationTier of [ExerciseGenerationTier.MANUAL_ONLY, ExerciseGenerationTier.STRENGTH_VARIANT]) {
    expect(pool({ ...machine, generationTier })).toEqual([band]);
  }
  expect(pool({ ...machine, generationTier: ExerciseGenerationTier.FALLBACK })).toContain(band);
});

it.each([
  { primaryMuscle: MuscleGroup.QUADS },
  { profile: ExerciseProfile.COMPOUND_SECONDARY },
  { movementVector: MovementVector.HIP_DOMINANT },
  { secondaryMuscles: [MuscleGroup.CORE] },
  { stimulusTags: ['DISTINCT_TASK'] },
  { criteria: undefined },
  { criteria: { ...machine.criteria!, loadProgressability: 2 } },
  { criteria: { ...machine.criteria!, rangeOfMotion: 1 } },
])('does not confuse different tasks, missing ratings or insufficient superiority: %j', (patch) => {
  expect(pool({ ...machine, ...patch } as Exercise)).toContain(band);
});

it('does not invent ratings or eliminate adequately progressable alternatives', () => {
  expect(pool(machine, { ...band, criteria: undefined })).toHaveLength(2);
  expect(pool(machine, { ...band, criteria: { ...band.criteria!, loadProgressability: 2 } })).toHaveLength(2);
  expect(pool({ ...machine, secondaryMuscles: [MuscleGroup.CORE, MuscleGroup.BICEPS] },
    { ...band, secondaryMuscles: [MuscleGroup.BICEPS, MuscleGroup.CORE, MuscleGroup.CORE] })).toEqual([
    { ...machine, secondaryMuscles: [MuscleGroup.CORE, MuscleGroup.BICEPS] },
  ]);
});
