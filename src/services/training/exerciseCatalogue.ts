/**
 * Exercise catalogue: loading, validation and derived scores (PRD §3.6).
 *
 * WHY VALIDATION EXISTS
 *   `exercises.json` is hand-edited, so a misspelled muscle is a matter of time.
 *   Without validation that value would reach the generator as `undefined` and
 *   produce a silently wrong routine. Here it fails with the exercise id and the
 *   offending field.
 *
 * TWO DERIVED QUANTITIES, NOT ONE SCORE
 *   The catalogue previously carried a single hand-assigned `effectiveness`. The
 *   biomechanical audit replaced it with six ordinal judgements, and those six
 *   collapse into two distinct quantities that the engine uses for different
 *   decisions:
 *
 *     stimulusQuality — an ordinal programming preference, not a measured
 *       hypertrophy effect size. Drives candidate selection.
 *     fatigueCost — an ordinal sequencing-cost heuristic, not measured central
 *       fatigue, joint stress or recovery time. Drives placement guidance.
 *
 *   Keeping them separate is the audit's central architectural point. A back squat
 *   scores 5 on stretched-position loading and 1 on systemic fatigue: it is an
 *   excellent stimulus AND an expensive one, and a single number cannot say both.
 *   Collapsing them is what makes an engine prescribe a mesocycle of free-barbell
 *   axial work that degrades performance before the block ends.
 */
import {
  Equipment,
  ExerciseGenerationTier,
  ExerciseProfile,
  MovementVector,
  MuscleGroup,
  type Exercise,
  type ExerciseCriteria,
} from '@/models';
import catalogueData from '@/data/exercises.json';
import guideData from '@/data/guide-exercises.json';
import { buildGuideExercises } from './guideExerciseCatalogue';

/** The six audited criteria, each scored 1-5. */
export const CRITERIA_KEYS = [
  'stretchedPositionLoading',
  'rangeOfMotion',
  'resistanceProfileMatch',
  'stabilityCost',
  'loadProgressability',
  'systemicFatigueCost',
] as const;

/**
 * Weights that turn the criteria into a stimulus-quality score.
 *
 * These weights are a transparent product heuristic, not effect sizes established
 * by head-to-head hypertrophy trials. In particular, a resistance-profile match
 * cannot by itself establish a superior long-term hypertrophy outcome.
 *
 * NEITHER cost criterion contributes. Fatigue is not a stimulus, and stability is
 * one of the two things fatigue is built from, so counting it here would both
 * double-count it and let cost decide selection. It also penalises free weights
 * systematically: a back squat scores 2 on stability and a hack squat 5, and an
 * engine that reads that as "less stimulus" quietly stops prescribing squats.
 *
 * Each criterion therefore belongs to exactly one derived quantity: four to
 * stimulus, two to fatigue, none to both.
 */
export const STIMULUS_WEIGHTS: Record<keyof ExerciseCriteria, number> = {
  stretchedPositionLoading: 0.35,
  resistanceProfileMatch: 0.15,
  rangeOfMotion: 0.27,
  loadProgressability: 0.23,
  stabilityCost: 0,
  systemicFatigueCost: 0,
};

/** Neutral criteria used only for calculations on unscored user-created movements. */
export const DEFAULT_CRITERIA: ExerciseCriteria = {
  stretchedPositionLoading: 3,
  rangeOfMotion: 3,
  resistanceProfileMatch: 3,
  stabilityCost: 3,
  loadProgressability: 3,
  systemicFatigueCost: 3,
};

export class CatalogueValidationError extends Error {
  constructor(
    public readonly exerciseId: string,
    public readonly field: string,
    public readonly value: unknown,
  ) {
    super(
      `Exercise "${exerciseId}": field "${field}" has an invalid value (${JSON.stringify(value)}).`,
    );
    this.name = 'CatalogueValidationError';
  }
}

function assertEnum<T extends Record<string, string>>(
  enumObject: T,
  value: unknown,
  exerciseId: string,
  field: string,
): T[keyof T] {
  if (typeof value !== 'string' || !Object.values(enumObject).includes(value)) {
    throw new CatalogueValidationError(exerciseId, field, value);
  }
  return value as T[keyof T];
}

function parseCriteria(raw: unknown, exerciseId: string): ExerciseCriteria {
  if (typeof raw !== 'object' || raw === null) {
    throw new CatalogueValidationError(exerciseId, 'criteria', raw);
  }
  const entry = raw as Record<string, unknown>;
  const criteria = {} as ExerciseCriteria;
  CRITERIA_KEYS.forEach((key) => {
    const score = entry[key];
    if (typeof score !== 'number' || !Number.isInteger(score) || score < 1 || score > 5) {
      throw new CatalogueValidationError(exerciseId, `criteria.${key}`, score);
    }
    criteria[key] = score as ExerciseCriteria[typeof key];
  });
  return criteria;
}

function parseStimulusTags(raw: unknown, exerciseId: string): string[] | undefined {
  if (raw === undefined) return undefined;
  if (
    !Array.isArray(raw) ||
    raw.some((tag) => typeof tag !== 'string' || !/^[A-Z_]+:[A-Z_]+$/.test(tag)) ||
    new Set(raw).size !== raw.length
  ) {
    throw new CatalogueValidationError(exerciseId, 'stimulusTags', raw);
  }
  return raw;
}

/** Validates one raw JSON entry and turns it into an `Exercise`. */
export function parseExercise(raw: unknown): Exercise {
  if (typeof raw !== 'object' || raw === null) {
    throw new CatalogueValidationError('(unknown)', 'entry', raw);
  }
  const entry = raw as Record<string, unknown>;
  const id = entry.id;
  if (typeof id !== 'string' || id.length === 0) {
    throw new CatalogueValidationError('(no id)', 'id', id);
  }
  if (typeof entry.name !== 'string' || entry.name.length === 0) {
    throw new CatalogueValidationError(id, 'name', entry.name);
  }
  if (!Array.isArray(entry.secondaryMuscles)) {
    throw new CatalogueValidationError(id, 'secondaryMuscles', entry.secondaryMuscles);
  }
  const secondaryMuscles = entry.secondaryMuscles.map((muscle) =>
    assertEnum(MuscleGroup, muscle, id, 'secondaryMuscles'),
  );
  const primaryMuscle = assertEnum(MuscleGroup, entry.primaryMuscle, id, 'primaryMuscle');

  // A muscle listed as both primary and secondary would be credited 1.5 sets per
  // set performed, inflating its volume without anyone noticing.
  if (secondaryMuscles.includes(primaryMuscle) || new Set(secondaryMuscles).size !== secondaryMuscles.length) {
    throw new CatalogueValidationError(id, 'secondaryMuscles', primaryMuscle);
  }

  const stimulusTags = parseStimulusTags(entry.stimulusTags, id);
  return {
    id,
    name: entry.name,
    primaryMuscle,
    secondaryMuscles,
    movementVector: assertEnum(MovementVector, entry.movementVector, id, 'movementVector'),
    profile: assertEnum(ExerciseProfile, entry.profile, id, 'profile'),
    equipment: assertEnum(Equipment, entry.equipment, id, 'equipment'),
    criteria: entry.generationTier === ExerciseGenerationTier.MANUAL_ONLY && entry.criteria === undefined
      ? undefined
      : parseCriteria(entry.criteria, id),
    generationTier:
      entry.generationTier === undefined
        ? ExerciseGenerationTier.STANDARD
        : assertEnum(ExerciseGenerationTier, entry.generationTier, id, 'generationTier'),
    ...(stimulusTags === undefined ? {} : { stimulusTags }),
    ...(typeof entry.guidePage === 'number' ? { guidePage: entry.guidePage } : {}),
    isCustom: false,
  };
}

/** Validates the whole catalogue and rejects duplicate ids. */
export function parseCatalogue(raw: unknown): Exercise[] {
  const root = raw as { exercises?: unknown };
  if (!Array.isArray(root?.exercises)) {
    throw new Error('The catalogue must have an "exercises" array.');
  }
  const exercises = root.exercises.map(parseExercise);
  const seen = new Set<string>();
  exercises.forEach((exercise) => {
    if (seen.has(exercise.id)) {
      throw new CatalogueValidationError(exercise.id, 'id', 'duplicate');
    }
    seen.add(exercise.id);
  });
  return exercises;
}

/**
 * Loaded catalogue, validated at import time: a broken catalogue must break the
 * build rather than produce a wrong routine.
 */
const auditedCatalogue = parseCatalogue(catalogueData);
const guideCatalogue = parseCatalogue({
  exercises: buildGuideExercises(guideData.exercises, auditedCatalogue),
});
export const EXERCISE_CATALOGUE: readonly Exercise[] = [...auditedCatalogue, ...guideCatalogue];

/** Scored criteria, or a neutral default for user-created entries. */
export function criteriaOf(exercise: Exercise): ExerciseCriteria {
  if (exercise.generationTier === ExerciseGenerationTier.MANUAL_ONLY && !exercise.criteria) {
    throw new Error(`Exercise "${exercise.id}" has no scoring rubric.`);
  }
  return exercise.criteria ?? DEFAULT_CRITERIA;
}

/**
 * Hypertrophy stimulus per set, normalised to 1-5 so it reads on the same scale
 * as the criteria it comes from. This is the selection weight.
 */
export function stimulusQuality(exercise: Exercise): number {
  const criteria = criteriaOf(exercise);
  return CRITERIA_KEYS.reduce(
    (sum, key) => sum + criteria[key] * STIMULUS_WEIGHTS[key],
    0,
  );
}

/**
 * Fatigue spent per set, on a 1-5 scale where higher means more expensive.
 *
 * Built from `systemicFatigueCost` (central fatigue, axial compression, joint
 * stress) plus a smaller contribution from `stabilityCost`, because a task that
 * stabilisers limit also degrades faster within a session. Both criteria are
 * scored so that 5 is GOOD, hence the inversion.
 */
export const FATIGUE_WEIGHTS = { systemic: 0.75, stability: 0.25 } as const;

export function fatigueCost(exercise: Exercise): number {
  // Unknown manual movements use the upper planning bound for sequencing only.
  // This is not an assigned exercise rating or evidence of high physiological fatigue.
  if (exercise.generationTier === ExerciseGenerationTier.MANUAL_ONLY && !exercise.criteria) return 5;
  const criteria = criteriaOf(exercise);
  return (
    (6 - criteria.systemicFatigueCost) * FATIGUE_WEIGHTS.systemic +
    (6 - criteria.stabilityCost) * FATIGUE_WEIGHTS.stability
  );
}

/**
 * Legacy catalogue-report flag: 4 or more on both stretch loading and profile
 * match. This is a rubric filter, not evidence of superior hypertrophy.
 */
export function isTopTierStimulus(exercise: Exercise): boolean {
  const criteria = criteriaOf(exercise);
  return criteria.stretchedPositionLoading >= 4 && criteria.resistanceProfileMatch >= 4;
}

export interface CatalogueFilter {
  /** Equipment the athlete has. Omitted means no equipment filter. */
  availableEquipment?: readonly Equipment[];
  /** Exercises the athlete vetoed: disliked, painful, or unavailable. */
  vetoedExerciseIds?: readonly string[];
}

/** Applies available equipment and vetoes. This is the filter the generator sees. */
export function filterCatalogue(
  catalogue: readonly Exercise[],
  filter: CatalogueFilter,
): Exercise[] {
  const vetoed = new Set(filter.vetoedExerciseIds ?? []);
  const equipment = filter.availableEquipment ? new Set(filter.availableEquipment) : undefined;
  return catalogue.filter((exercise) => {
    if (vetoed.has(exercise.id)) return false;
    if (
      equipment &&
      exercise.equipment !== Equipment.UNSPECIFIED &&
      !equipment.has(exercise.equipment)
    ) return false;
    return true;
  });
}

/** Exercises whose PRIMARY muscle is the given one. */
export function exercisesForMuscle(
  catalogue: readonly Exercise[],
  muscle: MuscleGroup,
): Exercise[] {
  return catalogue.filter((exercise) => exercise.primaryMuscle === muscle);
}
