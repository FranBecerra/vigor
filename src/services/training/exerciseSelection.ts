/**
 * Selección de ejercicios — LÓGICA PURA (PRD §3.6).
 *
 * QUÉ ES DETERMINISTA Y QUÉ NO
 *   Deterministas (y por tanto lo que se testea): el volumen atribuido a cada
 *   músculo, el reparto de series, el equilibrio de vectores y los topes.
 *   No determinista: QUÉ ejercicio concreto cubre cada hueco. Al algoritmo le da
 *   igual que salga sentadilla hack o sentadilla libre.
 *
 *   La semilla existe como función de PRODUCTO, no como recurso de testing: el
 *   atleta refresca la propuesta hasta que le gusta el conjunto, y la misma
 *   semilla devuelve el mismo conjunto.
 *
 * SERIES EJECUTADAS FRENTE A ATRIBUIDAS
 *   Una serie de press de banca se EJECUTA una vez, pero acredita 1 serie al
 *   pecho y 0,5 al tríceps y al deltoides frontal: 2 series atribuidas por 1
 *   ejecutada. Por eso la suma de los MEAV de todos los músculos es muy superior
 *   al trabajo real, y por eso el generador debe razonar sobre ambas cifras: el
 *   MEAV se cubre con volumen atribuido, pero lo que cansa al atleta y ocupa la
 *   sesión son las series ejecutadas.
 *
 * The production draw remains the audited weighted selector. An opt-in ordinal
 * comparator is retained for paired evaluation, not enabled by default until it
 * improves whole-routine outcomes across experience levels.
 */
import {
  Equipment,
  ExerciseGenerationTier,
  ExerciseProfile,
  MovementVector,
  MuscleGroup,
  type Exercise,
  type StrengthRole,
} from '@/models';
import { criteriaOf, stimulusQuality } from './exerciseCatalogue';
import { attributedVolumePerMinute, ISOLATION_VOLUME_PER_MINUTE, exerciseMinutes } from './trainingCapacity';
import {
  TrainingGoal,
  RegionEmphasis,
  totalSetsVerdict,
  TOTAL_SETS_RANGE,
  type TotalVolumeVerdict,
  type VolumePlan,
} from './volumePlan';

/**
 * COMPOUND PATTERNS THAT ARE NEVER SKIPPED.
 *
 * The audit scores hypertrophy stimulus per set, and that is not the whole value
 * of a squat or a hip hinge. Intermuscular coordination, axial loading,
 * transferable strength and systemic adaptation are outside what those six
 * criteria measure, so a plan must not drop these patterns just because a machine
 * scores better on resistance-profile match or costs less fatigue.
 *
 * Measured before this existed: `KNEE_DOMINANT` was absent from 1 in 10 generated
 * plans, and quad leg extension outranked the barbell squat on stimulus alone.
 *
 * Each pattern is required only when the plan actually trains one of its gating
 * muscles, so a plan with no leg volume is not forced to include a squat.
 */
export const FOUNDATIONAL_PATTERNS: readonly {
  vector: MovementVector;
  muscles: readonly MuscleGroup[];
}[] = [
  { vector: MovementVector.KNEE_DOMINANT, muscles: [MuscleGroup.QUADS] },
  { vector: MovementVector.HIP_DOMINANT, muscles: [MuscleGroup.HAMSTRINGS, MuscleGroup.GLUTES] },
  {
    vector: MovementVector.PUSH_HORIZONTAL,
    muscles: [MuscleGroup.CHEST],
  },
  { vector: MovementVector.PULL_VERTICAL, muscles: [MuscleGroup.LATS] },
  {
    vector: MovementVector.PULL_HORIZONTAL,
    muscles: [MuscleGroup.LATS, MuscleGroup.MID_BACK],
  },
];

/** Crédito que recibe un músculo secundario por cada serie ejecutada (PRD §3.2). */
export const SECONDARY_CREDIT = 0.5;

export interface SelectionConfig {
  /** Series mínimas para que un ejercicio merezca estar en el plan. */
  minSetsPerExercise: number;
  /** Tope de series por ejercicio y microciclo. */
  maxSetsPerExercise: number;
  /** Tope de ejercicios por músculo, para no fragmentar el volumen. */
  maxExercisesPerMuscle: number;
  /**
   * Refuerzo al peso de los multiarticulares mientras el músculo tiene mucho
   * volumen pendiente. Los pone primero sin necesidad de una regla de orden
   * aparte: cuando la necesidad es alta, su peso domina.
   */
  compoundBoost: number;
  /**
   * Exponente de la eficiencia por minuto cuando el plan está limitado por
   * TIEMPO. A 1 el sesgo es proporcional a la eficiencia; a 2 se acentúa lo
   * suficiente para que el aislamiento salga solo cuando no hay alternativa.
   */
  timeEfficiencyExponent: number;
  /**
   * Cuánto penaliza repetir un vector ya usado. Reparte los patrones de la sesión.
   */
  vectorPenalty: number;
  /**
   * Lo mismo cuando el techo es el TIEMPO, y mucho más bajo.
   *
   * La penalización por vector es buena para el equilibrio pero, con el tiempo
   * apretado, trabaja EN CONTRA del objetivo: los ejercicios de aislamiento suelen
   * ocupar vectores que los multiarticulares no usan, así que premiar la variedad
   * de patrones los favorece justo cuando son lo primero que debería sobrar.
   * Medido: con la penalización normal salían sentadilla sissy y extensión de
   * cuádriceps en un plan de tres horas semanales.
   */
  vectorPenaltyWhenTimeConstrained: number;
  /**
   * Tope de ejercicios por músculo cuando el techo es el TIEMPO. Más bajo que el
   * normal: con menos plazas, las ocupan los ejercicios de más peso, que son los
   * de mayor rendimiento por minuto.
   */
  maxExercisesPerMuscleWhenTimeConstrained: number;
  /**
   * Maximum compound variants with the same primary muscle and movement vector.
   * A barbell RDL and a dumbbell RDL are loading variants, not useful variety.
   */
  maxCompoundExercisesPerPattern: number;
  /** Prevents two heavy primary compounds for the same vector across muscles. */
  maxPrimaryCompoundsPerVector: number;
  /** Isolation variants are cheaper, but unlimited duplicates still add noise. */
  maxIsolationExercisesPerPattern: number;
  /** Only candidates close to the best option for a muscle remain in the draw. */
  candidateScoreWindow: number;
  /** Reduces the probability of repeatedly selecting the same equipment family. */
  equipmentFamilyPenalty: number;
  /** Boost for a variant that adds new stimulus dimensions for the same muscle. */
  stimulusNoveltyBonus: number;
  /** Probability penalty when a candidate repeats already-selected dimensions. */
  stimulusOverlapPenalty: number;
}

/**
 * Valores por defecto.
 *
 * El mínimo de 3 series es deliberado y no cosmético: con un mínimo de 2 el
 * algoritmo repartía 13 series de deltoides lateral entre cuatro variantes de
 * elevación lateral. No eran ejercicios raros, sino redundantes, y es el mismo
 * defecto de fondo. Concentrar el volumen en menos ejercicios y mejores es tanto
 * mejor programación como mejor propuesta.
 */
export const DEFAULT_SELECTION_CONFIG: SelectionConfig = {
  minSetsPerExercise: 3,
  // Keep each appearance in the productive 3–4 set range. More weekly work is
  // represented by a distinct variant, not by a six-set marathon on one lift.
  maxSetsPerExercise: 4,
  maxExercisesPerMuscle: 4,
  compoundBoost: 2.5,
  timeEfficiencyExponent: 2,
  vectorPenalty: 0.6,
  vectorPenaltyWhenTimeConstrained: 0.15,
  maxExercisesPerMuscleWhenTimeConstrained: 2,
  maxCompoundExercisesPerPattern: 1,
  maxPrimaryCompoundsPerVector: 1,
  maxIsolationExercisesPerPattern: 3,
  candidateScoreWindow: 0.9,
  equipmentFamilyPenalty: 0.45,
  stimulusNoveltyBonus: 1.2,
  stimulusOverlapPenalty: 0.8,
};

/** One appearance of a strength lift in the microcycle. */
export interface StrengthExposure {
  /** Sets in this appearance, the top single included when there is one. */
  sets: number;
  /** true when the first set is a heavy single (only the main lift's heavy day). */
  topSingle: boolean;
}

/**
 * How a strength plan prescribes an exercise. Absent in hypertrophy plans, whose
 * rest and repetitions follow the exercise profile.
 */
export interface StrengthPrescription {
  role: StrengthRole;
  restSeconds: number;
  /**
   * Explicit appearances. A main lift trained twice is ONE exercise with two
   * exposures, so the distributor places it in two different sessions.
   */
  exposures: StrengthExposure[];
}

export interface SelectedExercise {
  exercise: Exercise;
  /** Series EJECUTADAS de este ejercicio por microciclo. */
  sets: number;
  strength?: StrengthPrescription;
}

export interface UnmetVolume {
  muscle: MuscleGroup;
  /** Series atribuidas que pedía el plan. */
  target: number;
  /** Series atribuidas que se han conseguido. */
  attributed: number;
  /**
   * true si el déficit es menor que el mínimo de series de un ejercicio, así que
   * no se puede cerrar sin pasarse del objetivo.
   *
   * La distinción importa: un hueco de 1,5 series en el deltoides frontal no es
   * un fallo de programación, es el resto que queda cuando el músculo se nutre
   * de trabajo indirecto. Añadir tres series de elevación frontal para cerrarlo
   * empeoraría el plan. Un hueco de 8 series sí es un problema real, y suele
   * significar que el material disponible o los vetos dejaron al músculo sin
   * ejercicios.
   */
  uncloseable: boolean;
}

export interface SelectionResult {
  selected: SelectedExercise[];
  /** Series que el atleta EJECUTA de verdad en el microciclo. */
  performedSets: number;
  /** Series ATRIBUIDAS: principal completo más 0,5 por secundario. */
  attributedSets: number;
  attributedByMuscle: Partial<Record<MuscleGroup, number>>;
  vectorCounts: Partial<Record<MovementVector, number>>;
  /**
   * Foundational patterns the plan trains muscles for but could not include,
   * because the athlete's equipment or vetoes leave no compound option. Reported
   * rather than silently skipped: it is the kind of gap worth telling someone about.
   */
  missingFoundationalPatterns: MovementVector[];
  /** Músculos cuyo objetivo no se ha podido cubrir, y por cuánto. */
  unmet: UnmetVolume[];
  /**
   * Si las series EJECUTADAS caen dentro del rango de volumen total del objetivo
   * y el nivel. Es la comprobación de sensatez del plan completo: sumar bien
   * músculo a músculo no garantiza que el conjunto sea razonable.
   */
  totalVerdict: TotalVolumeVerdict;
}

// --- Aleatoriedad reproducible ---------------------------------------------

/**
 * Generador con semilla (mulberry32). Hace falta uno propio porque `Math.random`
 * no acepta semilla, y sin semilla el botón de refrescar no podría volver a una
 * propuesta anterior.
 */
export function createRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Elige un elemento con probabilidad proporcional a su peso.
 * Con pesos no positivos cae a una elección uniforme, para no devolver nada
 * cuando todos los candidatos están penalizados al mismo tiempo.
 */
export function weightedPick<T>(
  items: readonly T[],
  weightOf: (item: T) => number,
  random: () => number,
): T | undefined {
  if (items.length === 0) return undefined;

  const weights = items.map((item) => Math.max(0, weightOf(item)));
  const total = weights.reduce((sum, weight) => sum + weight, 0);

  if (total <= 0) return items[Math.floor(random() * items.length)];

  let threshold = random() * total;
  for (let index = 0; index < items.length; index += 1) {
    threshold -= weights[index];
    if (threshold < 0) return items[index];
  }
  return items[items.length - 1];
}

// --- Selección --------------------------------------------------------------

const COMPOUND_PROFILES: readonly ExerciseProfile[] = [
  ExerciseProfile.COMPOUND_PRIMARY,
  ExerciseProfile.COMPOUND_SECONDARY,
];

function isCompound(exercise: Exercise): boolean {
  return COMPOUND_PROFILES.includes(exercise.profile);
}

type EquipmentFamily = 'FREE_WEIGHT' | 'GUIDED' | 'BODYWEIGHT' | 'OTHER';

/** Coarse equipment family used for diversity, never as a claim of superiority. */
export function equipmentFamily(exercise: Exercise): EquipmentFamily {
  switch (exercise.equipment) {
    case Equipment.BARBELL:
    case Equipment.SAFETY_BAR:
    case Equipment.TRAP_BAR:
    case Equipment.LANDMINE:
    case Equipment.DUMBBELL:
    case Equipment.KETTLEBELL:
      return 'FREE_WEIGHT';
    case Equipment.MACHINE:
    case Equipment.CABLE:
    case Equipment.SMITH_MACHINE:
      return 'GUIDED';
    case Equipment.BODYWEIGHT:
    case Equipment.ROMAN_CHAIR:
    case Equipment.STABILITY_BALL:
      return 'BODYWEIGHT';
    default:
      return 'OTHER';
  }
}

/**
 * Goal-specific production/reporting score. The experimental ordinal policy
 * uses priority layers first; strength gives more weight to
 * reproducible loading and multi-joint skill practice; high loads improve 1RM
 * more reliably even though hypertrophy is possible across a broad load range.
 * This is a transparent programming heuristic, not a universal exercise ranking.
 */
export function goalSelectionScore(exercise: Exercise, goal: TrainingGoal): number {
  if (goal === TrainingGoal.HYPERTROPHY) return stimulusQuality(exercise);

  const criteria = criteriaOf(exercise);
  const base =
    criteria.loadProgressability * 0.5 +
    criteria.rangeOfMotion * 0.15 +
    criteria.stretchedPositionLoading * 0.15 +
    criteria.stabilityCost * 0.1 +
    criteria.resistanceProfileMatch * 0.1;
  const profileMultiplier =
    exercise.profile === ExerciseProfile.COMPOUND_PRIMARY
      ? 1.35
      : exercise.profile === ExerciseProfile.COMPOUND_SECONDARY
        ? 1.1
        : 0.72;
  const barbellMultiplier = exercise.equipment === Equipment.BARBELL ? 1.15 : 1;
  return base * profileMultiplier * barbellMultiplier;
}

/**
 * Meaningful ordinal superiority for the same target muscle. A one-point gap
 * in one criterion remains a tie because most catalogue ratings are expert
 * judgements. Stability and load progression act as adequacy checks; machine
 * support alone cannot eliminate a free-weight alternative. Resistance-curve
 * matching is a weak draw tie-breaker, not a dominance criterion. Recovery cost
 * is handled by distribution and never enters this comparison.
 */
export function hypertrophyDominates(a: Exercise, b: Exercise): boolean {
  if (a.primaryMuscle !== b.primaryMuscle || a.id === b.id) return false;
  const left = criteriaOf(a);
  const right = criteriaOf(b);
  if (left.stretchedPositionLoading < right.stretchedPositionLoading ||
      left.rangeOfMotion < right.rangeOfMotion) return false;
  if (left.stabilityCost < 2 || left.loadProgressability < 2) return false;
  if (right.stabilityCost >= 2 && left.stabilityCost < 2) return false;
  if (right.loadProgressability >= 3 && left.loadProgressability < 3) return false;
  const stretchGain = left.stretchedPositionLoading - right.stretchedPositionLoading;
  const rangeGain = left.rangeOfMotion - right.rangeOfMotion;
  const clearPracticalGain =
    (left.stabilityCost >= 3 && right.stabilityCost <= 1) ||
    (left.loadProgressability >= 3 && right.loadProgressability <= 2);
  // Stretch loading and ROM are often correlated descriptions of one movement.
  // Two adjacent one-point judgements do not provide independent confirmation.
  return stretchGain >= 2 || rangeGain >= 2 || clearPracticalGain;
}

/** Non-dominated fronts within each primary-muscle comparison; zero is preferred. */
export function hypertrophyPriorityLayers(exercises: readonly Exercise[]): Map<string, number> {
  const layers = new Map<string, number>();
  let remaining = [...exercises];
  let layer = 0;
  while (remaining.length > 0) {
    const front = remaining.filter(
      (candidate) => !remaining.some((other) => hypertrophyDominates(other, candidate)),
    );
    // A defensive fallback keeps malformed or cyclic custom ratings selectable.
    const current = front.length > 0 ? front : remaining;
    current.forEach((exercise) => layers.set(exercise.id, layer));
    const frontIds = new Set(current.map((exercise) => exercise.id));
    remaining = remaining.filter((exercise) => !frontIds.has(exercise.id));
    layer += 1;
  }
  return layers;
}

/**
 * Fallback exercises stay available when equipment/vetoes leave no standard
 * alternative, but never displace a standard option by random chance.
 */
function preferStandard(candidates: readonly Exercise[]): Exercise[] {
  const standard = candidates.filter(
    (exercise) => exercise.generationTier !== ExerciseGenerationTier.FALLBACK,
  );
  return standard.length > 0 ? standard : [...candidates];
}

/** Removes clearly inferior lottery tickets while preserving meaningful variety. */
function competitiveCandidates(
  candidates: readonly Exercise[],
  goal: TrainingGoal,
  window: number,
  scoreOf: (exercise: Exercise) => number = (exercise) => goalSelectionScore(exercise, goal),
  rankingPolicy: RankingPolicy = 'ordinal',
): Exercise[] {
  const eligible = preferStandard(candidates);
  if (goal === TrainingGoal.HYPERTROPHY && rankingPolicy === 'ordinal') {
    const layers = hypertrophyPriorityLayers(eligible);
    return eligible.filter((exercise) => layers.get(exercise.id) === 0);
  }
  const best = eligible.reduce(
    (maximum, exercise) => Math.max(maximum, scoreOf(exercise)),
    Number.NEGATIVE_INFINITY,
  );
  return eligible.filter((exercise) => scoreOf(exercise) >= best - window);
}

/**
 * Exercises in the same family solve the same primary programming problem.
 * Equipment is deliberately absent: changing the implement does not turn an RDL
 * into a second movement pattern.
 */
function patternKey(exercise: Exercise): string {
  return `${exercise.primaryMuscle}:${exercise.movementVector}:${isCompound(exercise) ? 'compound' : 'isolation'}`;
}

export interface SelectionInput {
  /** Plan de volumen. Solo se atienden los músculos con objetivo mayor que cero. */
  volumePlan: VolumePlan;
  /** Catálogo YA filtrado por material disponible y vetos. */
  catalogue: readonly Exercise[];
  seed: number;
  /** Comparison harness only; production defaults to the weighted policy. */
  rankingPolicy?: RankingPolicy;
  config?: Partial<SelectionConfig>;
  /**
   * true cuando el plan está recortado por falta de TIEMPO, no de recuperación.
   *
   * Mantiene el refuerzo a los multiarticulares activo aunque quede poco volumen
   * por cubrir. Sin esto la lógica se vuelve del revés justo cuando más importa:
   * el refuerzo normal se apaga al bajar el volumen pendiente, así que un plan
   * recortado elegiría MÁS aislamiento, que es lo contrario de lo que conviene
   * cuando cada minuto cuenta. Un multiarticular acredita varios músculos por
   * serie ejecutada, así que rinde más por minuto.
   */
  timeConstrained?: boolean;
}

export type RankingPolicy = 'ordinal' | 'legacy-weighted' | 'volume-aware' | 'accessory-aware' | 'coupled-control';

/** Programming roles, not anatomical size or a universal efficacy ranking. */
export function prefersTargetedAccessory(muscle: MuscleGroup): boolean {
  return [MuscleGroup.BICEPS, MuscleGroup.TRICEPS, MuscleGroup.DELTS_FRONT,
    MuscleGroup.DELTS_LATERAL, MuscleGroup.DELTS_REAR].includes(muscle);
}

/** Prefer local work after basic coverage; retain compounds when no isolation is available. */
export function accessoryCandidates(candidates: readonly Exercise[], muscle: MuscleGroup): Exercise[] {
  const local = candidates.filter((exercise) => !isCompound(exercise)
    || (exercise.primaryMuscle === muscle && [MovementVector.ELBOW_EXTENSION, MovementVector.ELBOW_FLEXION]
      .includes(exercise.movementVector)));
  return prefersTargetedAccessory(muscle) && local.length ? local : [...candidates];
}

/** Count only credit still needed by the target budget; surplus is not utility. */
export function remainingVolumeUtility(exercise: Exercise, sets: number,
  targets: ReadonlyMap<MuscleGroup, number>, attributed: ReadonlyMap<MuscleGroup, number>): number {
  if (!Number.isFinite(sets) || sets <= 0) return 0;
  const missing = (muscle: MuscleGroup) => Math.max(0, (targets.get(muscle) ?? 0) - (attributed.get(muscle) ?? 0));
  let utility = Math.min(sets, missing(exercise.primaryMuscle));
  for (const muscle of new Set(exercise.secondaryMuscles)) {
    if (muscle !== exercise.primaryMuscle) utility += Math.min(sets * SECONDARY_CREDIT, missing(muscle));
  }
  return utility;
}

/** Direct arm work floor: explicit programming heuristic, not measured MEV. */
export function directVolumeFloor(muscle: MuscleGroup, target: number): number {
  return target >= 6 && (muscle === MuscleGroup.BICEPS || muscle === MuscleGroup.TRICEPS)
    ? Math.min(8, Math.max(6, Math.ceil(target * 0.6))) : 0;
}

/** Acumula el crédito de un ejercicio en el mapa de volumen atribuido. */
function credit(
  attributed: Map<MuscleGroup, number>,
  exercise: Exercise,
  sets: number,
): void {
  attributed.set(exercise.primaryMuscle, (attributed.get(exercise.primaryMuscle) ?? 0) + sets);
  new Set(exercise.secondaryMuscles).forEach((muscle) => {
    if (muscle === exercise.primaryMuscle) return;
    attributed.set(muscle, (attributed.get(muscle) ?? 0) + sets * SECONDARY_CREDIT);
  });
}

export function selectExercises(input: SelectionInput): SelectionResult {
  const config = { ...DEFAULT_SELECTION_CONFIG, ...input.config };
  const rankingPolicy = input.rankingPolicy ?? 'legacy-weighted';
  const random = createRandom(input.seed);
  const pool = input.catalogue.filter(
    (exercise) => exercise.generationTier !== ExerciseGenerationTier.STRENGTH_VARIANT &&
      exercise.generationTier !== ExerciseGenerationTier.MANUAL_ONLY,
  );
  const maxExercisesPerMuscle =
    input.timeConstrained === true
      ? Math.min(config.maxExercisesPerMuscle, config.maxExercisesPerMuscleWhenTimeConstrained)
      : config.maxExercisesPerMuscle;
  const priorityMuscles = new Set(input.volumePlan.muscles
    .filter((muscle) => muscle.emphasis === RegionEmphasis.PRIORITY).map((muscle) => muscle.muscle));

  const targets = new Map<MuscleGroup, number>();
  input.volumePlan.muscles.forEach((target) => {
    if (target.meav > 0) targets.set(target.muscle, target.meav);
  });

  const attributed = new Map<MuscleGroup, number>();
  const direct = new Map<MuscleGroup, number>();
  const vectorCounts = new Map<MovementVector, number>();
  const chosen = new Map<string, SelectedExercise>();
  const countPerMuscle = new Map<MuscleGroup, number>();
  const countPerPattern = new Map<string, number>();
  const primaryCompoundsPerVector = new Map<MovementVector, number>();
  const chosenStimulusVariants = new Set<string>();
  const countPerEquipmentFamily = new Map<EquipmentFamily, number>();
  /** Músculos para los que ya se agotaron los candidatos o el tope. */
  const closed = new Set<MuscleGroup>();

  // Fractional indirect credit is useful for total-volume accounting, but it
  // must not replace all direct elbow-flexor/extensor work. This floor is a
  // conservative programming choice, not an experimentally validated MEV.
  const directFloor = (muscle: MuscleGroup, target: number): number =>
    directVolumeFloor(muscle, target);
  const recordDirect = (exercise: Exercise, sets: number): void => {
    direct.set(exercise.primaryMuscle, (direct.get(exercise.primaryMuscle) ?? 0) + sets);
  };

  const patternHasRoom = (exercise: Exercise): boolean => {
    const limit = isCompound(exercise)
      ? config.maxCompoundExercisesPerPattern
      : config.maxIsolationExercisesPerPattern;
    if (
      exercise.profile === ExerciseProfile.COMPOUND_PRIMARY &&
      (primaryCompoundsPerVector.get(exercise.movementVector) ?? 0) >=
        config.maxPrimaryCompoundsPerVector
    ) {
      return false;
    }
    return (countPerPattern.get(patternKey(exercise)) ?? 0) < limit;
  };

  const stimulusVariantKey = (exercise: Exercise): string | undefined =>
    exercise.stimulusTags === undefined
      ? undefined
      : `${exercise.primaryMuscle}:${[...exercise.stimulusTags].sort().join('|')}`;

  const stimulusVariantHasRoom = (exercise: Exercise): boolean => {
    const key = stimulusVariantKey(exercise);
    return key === undefined || !chosenStimulusVariants.has(key);
  };

  const recordPattern = (exercise: Exercise): void => {
    const key = patternKey(exercise);
    countPerPattern.set(key, (countPerPattern.get(key) ?? 0) + 1);
    if (exercise.profile === ExerciseProfile.COMPOUND_PRIMARY) {
      primaryCompoundsPerVector.set(
        exercise.movementVector,
        (primaryCompoundsPerVector.get(exercise.movementVector) ?? 0) + 1,
      );
    }
    const variant = stimulusVariantKey(exercise);
    if (variant !== undefined) chosenStimulusVariants.add(variant);
  };

  const recordEquipmentFamily = (exercise: Exercise): void => {
    const family = equipmentFamily(exercise);
    countPerEquipmentFamily.set(family, (countPerEquipmentFamily.get(family) ?? 0) + 1);
  };

  const stimulusTagsOf = (exercise: Exercise): readonly string[] =>
    exercise.stimulusTags ?? [`MOVEMENT:${exercise.movementVector}`];

  const chosenTagsFor = (muscle: MuscleGroup): Set<string> =>
    new Set(
      [...chosen.values()]
        .filter((entry) => entry.exercise.primaryMuscle === muscle)
        .flatMap((entry) => stimulusTagsOf(entry.exercise)),
    );

  const noveltyAdjustedScore = (exercise: Exercise): number => {
    // The ordinal front controls eligibility. The legacy score is retained only
    // as a draw weight within that front, so near-ties stay selectable.
    const base = goalSelectionScore(exercise, input.volumePlan.goal);
    const existing = chosenTagsFor(exercise.primaryMuscle);
    if (existing.size === 0) return base;
    const tags = stimulusTagsOf(exercise);
    const novelFraction = tags.filter((tag) => !existing.has(tag)).length / tags.length;
    return (
      base +
      novelFraction * config.stimulusNoveltyBonus
    );
  };

  const diversityAdjustedScore = (exercise: Exercise): number => {
    const used = countPerEquipmentFamily.get(equipmentFamily(exercise)) ?? 0;
    const existing = chosenTagsFor(exercise.primaryMuscle);
    const tags = stimulusTagsOf(exercise);
    const overlapFraction =
      existing.size === 0 ? 0 : tags.filter((tag) => existing.has(tag)).length / tags.length;
    return (
      noveltyAdjustedScore(exercise) /
      (1 + used * config.equipmentFamilyPenalty) /
      (1 + overlapFraction * config.stimulusOverlapPenalty)
    );
  };

  /** Volumen que le falta a un músculo, dado su objetivo. */
  const remainingOf = (muscle: MuscleGroup, target: number): number =>
    Math.max(
      target - (attributed.get(muscle) ?? 0),
      directFloor(muscle, target) - (direct.get(muscle) ?? 0),
    );

  /** Músculo con más volumen pendiente que todavía admite otro ejercicio. */
  const neediest = (): { muscle: MuscleGroup; remaining: number } | undefined => {
    let best: { muscle: MuscleGroup; remaining: number } | undefined;
    targets.forEach((target, muscle) => {
      if (closed.has(muscle)) return;
      const remaining = remainingOf(muscle, target);
      if (remaining < config.minSetsPerExercise) return;
      if (best === undefined || remaining > best.remaining) best = { muscle, remaining };
    });
    return best;
  };

  // FASE 0 — el suelo de patrones fundamentales. Se coloca ANTES del reparto por
  // volumen para que un patrón de sentadilla o de dominante de cadera no dependa
  // de que gane un sorteo ponderado, y para que el volumen que consume se
  // descuente del objetivo en lugar de sumarse encima.
  const missingFoundationalPatterns: MovementVector[] = [];
  FOUNDATIONAL_PATTERNS.forEach(({ vector, muscles }) => {
    const trains = muscles.some((muscle) => (targets.get(muscle) ?? 0) > 0);
    if (!trains) return;

    const rawCandidates = pool.filter(
      (exercise) =>
        exercise.movementVector === vector &&
        isCompound(exercise) &&
        !chosen.has(exercise.id) &&
        targets.has(exercise.primaryMuscle),
    );
    if (rawCandidates.length === 0) {
      missingFoundationalPatterns.push(vector);
      return;
    }

    const foundationalCandidates = rankingPolicy === 'accessory-aware' && input.volumePlan.goal === TrainingGoal.HYPERTROPHY
      ? rawCandidates.filter((e) => !prefersTargetedAccessory(e.primaryMuscle)) : rawCandidates;
    const candidates = competitiveCandidates(
      foundationalCandidates.length ? foundationalCandidates : rawCandidates,
      input.volumePlan.goal,
      config.candidateScoreWindow,
      undefined,
      rankingPolicy,
    );
    const pick = weightedPick(candidates, diversityAdjustedScore, random)!;
    const sets = config.minSetsPerExercise;
    chosen.set(pick.id, { exercise: pick, sets });
    recordPattern(pick);
    recordEquipmentFamily(pick);
    countPerMuscle.set(
      pick.primaryMuscle,
      (countPerMuscle.get(pick.primaryMuscle) ?? 0) + 1,
    );
    vectorCounts.set(vector, (vectorCounts.get(vector) ?? 0) + 1);
    credit(attributed, pick, sets);
    recordDirect(pick, sets);
  });

  // FASE 1 — elegir ejercicios. Cada uno entra con el mínimo de series; el
  // ajuste fino se hace en la fase 2, cuando ya se conoce el crédito indirecto
  // que se han repartido entre ellos.
  for (;;) {
    const next = neediest();
    if (next === undefined) break;
    const { muscle, remaining } = next;

    // A tiny time overflow must not abruptly cap a priority muscle at two
    // variants. Let capacity search reduce its budget continuously instead.
    const exerciseLimit = priorityMuscles.has(muscle) ? config.maxExercisesPerMuscle : maxExercisesPerMuscle;
    if ((countPerMuscle.get(muscle) ?? 0) >= exerciseLimit) {
      closed.add(muscle);
      continue;
    }

    const rawAvailable = pool.filter(
      (exercise) =>
        exercise.primaryMuscle === muscle &&
        !chosen.has(exercise.id) &&
        patternHasRoom(exercise) &&
        stimulusVariantHasRoom(exercise),
    );
    // A fallback compound is not a reason to discard standard isolations under
    // time pressure. First establish which suitability tier is available, then
    // apply the compound preference within that tier.
    const standardAvailable = preferStandard(rawAvailable);
    const rawCompounds = standardAvailable.filter(isCompound);
    const candidatePool =
      rankingPolicy === 'accessory-aware' && input.volumePlan.goal === TrainingGoal.HYPERTROPHY
        ? accessoryCandidates(standardAvailable, muscle)
        : ((input.timeConstrained === true && rankingPolicy !== 'volume-aware') || input.volumePlan.goal === TrainingGoal.STRENGTH) &&
      rawCompounds.length > 0
        ? rawCompounds
        : standardAvailable;
    const available = competitiveCandidates(
      candidatePool,
      input.volumePlan.goal,
      config.candidateScoreWindow,
      noveltyAdjustedScore,
      rankingPolicy,
    );
    if (available.length === 0) {
      closed.add(muscle);
      continue;
    }

    // Legacy controls retain compound-first eligibility. Accessory-aware selection
    // instead completes arm/delt targets with local work after basic coverage;
    // a compound can still enter after those alternatives are exhausted.
    const candidates = available;

    // `candidates` no está vacío, así que weightedPick siempre devuelve uno.
    const pick = weightedPick(
      candidates,
      (exercise) => {
        let weight = diversityAdjustedScore(exercise);

        if (rankingPolicy === 'volume-aware' || rankingPolicy === 'accessory-aware') {
          const sets = config.minSetsPerExercise;
          const utility = remainingVolumeUtility(exercise, sets, targets, attributed);
          // A primary direct-work requirement can remain after indirect credit.
          const directNeed = Math.min(sets, Math.max(0, directFloor(muscle, targets.get(muscle) ?? 0) - (direct.get(muscle) ?? 0)));
          const useful = Math.max(utility, directNeed);
          const systemicDemand = 6 - criteriaOf(exercise).systemicFatigueCost;
          return weight * useful / Math.max(1, exerciseMinutes(exercise, sets)) / (1 + systemicDemand * 0.1);
        }

        if (input.timeConstrained === true) {
          // Con el tiempo como techo, el criterio es el VOLUMEN POR MINUTO, no un
          // refuerzo plano a los multiarticulares. Un remo con barra acredita tres
          // músculos y medio por serie en los mismos 220 s que una extensión de
          // cuádriceps acredita uno: cuatro veces más rendimiento por minuto. Es
          // el cálculo que hace que el aislamiento sea lo primero que sobra.
          weight *=
            (attributedVolumePerMinute(exercise) / ISOLATION_VOLUME_PER_MINUTE) **
            config.timeEfficiencyExponent;
        } else if (isCompound(exercise) && remaining > config.minSetsPerExercise * 2) {
          weight *= config.compoundBoost;
        }

        // Un vector ya muy usado pesa menos, para que la sesión no acumule el
        // mismo patrón.
        const used = vectorCounts.get(exercise.movementVector) ?? 0;
        const penalty =
          input.timeConstrained === true
            ? config.vectorPenaltyWhenTimeConstrained
            : config.vectorPenalty;
        return weight / (1 + used * penalty);
      },
      random,
    )!;

    const sets = Math.min(config.minSetsPerExercise, config.maxSetsPerExercise);
    chosen.set(pick.id, { exercise: pick, sets });
    recordPattern(pick);
    recordEquipmentFamily(pick);
    countPerMuscle.set(muscle, (countPerMuscle.get(muscle) ?? 0) + 1);
    vectorCounts.set(pick.movementVector, (vectorCounts.get(pick.movementVector) ?? 0) + 1);
    credit(attributed, pick, sets);
    recordDirect(pick, sets);
  }

  return allocateExerciseVolume([...chosen.values()], input, config, rankingPolicy, missingFoundationalPatterns);
}

/** Dose a fixed exercise roster. Does not add, swap or mutate exercise identities. */
export function allocateExerciseVolume(
  candidates: readonly SelectedExercise[],
  input: Pick<SelectionInput, 'volumePlan'>,
  config: SelectionConfig = DEFAULT_SELECTION_CONFIG,
  rankingPolicy: RankingPolicy = 'legacy-weighted',
  missingFoundationalPatterns: MovementVector[] = [],
): SelectionResult {
  const chosen = new Map(candidates.map((entry) => [entry.exercise.id, { ...entry }]));
  const targets = new Map(input.volumePlan.muscles.filter((m) => m.meav > 0).map((m) => [m.muscle, m.meav]));
  const attributed = new Map<MuscleGroup, number>();
  const direct = new Map<MuscleGroup, number>();
  const recordDirect = (exercise: Exercise, sets: number) => {
    direct.set(exercise.primaryMuscle, (direct.get(exercise.primaryMuscle) ?? 0) + sets);
  };
  chosen.forEach((entry) => { credit(attributed, entry.exercise, entry.sets); recordDirect(entry.exercise, entry.sets); });
  const remainingOf = (muscle: MuscleGroup, target: number) => Math.max(
    target - (attributed.get(muscle) ?? 0), directVolumeFloor(muscle, target) - (direct.get(muscle) ?? 0),
  );
  const chosenLayers = input.volumePlan.goal === TrainingGoal.HYPERTROPHY && rankingPolicy === 'ordinal'
    ? hypertrophyPriorityLayers([...chosen.values()].map((entry) => entry.exercise))
    : undefined;
  const byStimulus = [...chosen.values()].sort((a, b) =>
    chosenLayers
      ? (chosenLayers.get(a.exercise.id) ?? 0) - (chosenLayers.get(b.exercise.id) ?? 0)
      : goalSelectionScore(b.exercise, input.volumePlan.goal) - goalSelectionScore(a.exercise, input.volumePlan.goal));

  let progressed = true;
  while (progressed) {
    progressed = false;
    const [, totalSetCeiling] = TOTAL_SETS_RANGE[input.volumePlan.goal][input.volumePlan.level];
    targets.forEach((target, muscle) => {
      if ([...chosen.values()].reduce((sum, entry) => sum + entry.sets, 0) >= totalSetCeiling) {
        return;
      }
      if (remainingOf(muscle, target) < 1) return;
      const entry = byStimulus.find(
        (candidate) =>
          candidate.exercise.primaryMuscle === muscle &&
          candidate.sets < config.maxSetsPerExercise,
      );
      if (entry === undefined) return;
      entry.sets += 1;
      credit(attributed, entry.exercise, 1);
      recordDirect(entry.exercise, 1);
      progressed = true;
    });
  }

  const selected = [...chosen.values()];
  return summarizeSelection(selected, input.volumePlan, missingFoundationalPatterns, config.minSetsPerExercise);
}

/**
 * The derived figures of a selection: executed and attributed sets, per-muscle
 * credit, pattern counts, unmet volume and the total-volume verdict. Shared by the
 * hypertrophy selector and the strength program so both report the same way.
 */
export function summarizeSelection(
  selected: SelectedExercise[],
  volumePlan: VolumePlan,
  missingFoundationalPatterns: MovementVector[],
  minSetsPerExercise: number = DEFAULT_SELECTION_CONFIG.minSetsPerExercise,
): SelectionResult {
  const attributed = new Map<MuscleGroup, number>();
  const vectorCounts = new Map<MovementVector, number>();
  selected.forEach((entry) => {
    credit(attributed, entry.exercise, entry.sets);
    vectorCounts.set(
      entry.exercise.movementVector,
      (vectorCounts.get(entry.exercise.movementVector) ?? 0) + 1,
    );
  });
  const targets = new Map<MuscleGroup, number>();
  volumePlan.muscles.forEach((target) => {
    if (target.meav > 0) targets.set(target.muscle, target.meav);
  });

  const performedSets = selected.reduce((sum, entry) => sum + entry.sets, 0);
  const attributedSets = selected.reduce(
    (sum, entry) => sum + entry.sets * (1 + entry.exercise.secondaryMuscles.length * SECONDARY_CREDIT),
    0,
  );

  const unmet: UnmetVolume[] = [];
  targets.forEach((target, muscle) => {
    const got = attributed.get(muscle) ?? 0;
    const deficit = target - got;
    // Medio punto de tolerancia: el crédito secundario se mueve en medios y un
    // déficit de 0,5 series no es un hueco real de programación.
    if (deficit > 0.5) {
      unmet.push({
        muscle,
        target,
        attributed: got,
        uncloseable: deficit < minSetsPerExercise,
      });
    }
  });

  return {
    selected,
    performedSets,
    attributedSets,
    // Una descarga y un plan recortado por tiempo están por debajo del rango de
    // recuperación por construcción, así que compararlos con él daría siempre
    // 'below' y el veredicto no diría nada de lo que importa.
    totalVerdict:
      volumePlan.isDeload || volumePlan.capacityCapped
        ? 'not-applicable'
        : totalSetsVerdict(performedSets, volumePlan.goal, volumePlan.level),
    attributedByMuscle: Object.fromEntries(attributed) as Partial<Record<MuscleGroup, number>>,
    vectorCounts: Object.fromEntries(vectorCounts) as Partial<Record<MovementVector, number>>,
    missingFoundationalPatterns,
    unmet,
  };
}
