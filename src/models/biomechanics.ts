/**
 * Taxonomía de Ejercicios y Biomecánica.
 * Fuente de verdad: PRD.md §6 (modelo 1), §3.5 (motor de sustitución), §4.1 (veto
 * biomecánico por lesión) y §3.6 (generador de mesociclos).
 */

/**
 * Grupos musculares con taxonomía detallada (PRD §3.5.2):
 * separación de porciones del deltoides y del trapecio.
 */
export enum MuscleGroup {
  DELTS_FRONT = 'DELTS_FRONT',
  DELTS_LATERAL = 'DELTS_LATERAL',
  DELTS_REAR = 'DELTS_REAR',
  TRAPS_UPPER = 'TRAPS_UPPER',
  TRAPS_MID_LOWER = 'TRAPS_MID_LOWER',
  CHEST_UPPER = 'CHEST_UPPER',
  CHEST_MID_LOWER = 'CHEST_MID_LOWER',
  LATS = 'LATS',
  RHOMBOIDS = 'RHOMBOIDS',
  ERECTORS = 'ERECTORS',
  QUADS = 'QUADS',
  HAMSTRINGS = 'HAMSTRINGS',
  GLUTES = 'GLUTES',
  ADDUCTORS = 'ADDUCTORS',
  CALVES = 'CALVES',
  TIBIALIS = 'TIBIALIS',
  BICEPS = 'BICEPS',
  TRICEPS = 'TRICEPS',
  CORE = 'CORE',
}

/**
 * Patrón de movimiento del ejercicio.
 *
 * POR QUÉ ESTA GRANULARIDAD: antes existía un único `ISOLATION` que agrupaba
 * curl de bíceps, elevación lateral, extensión de cuádriceps y crunch. Con un
 * cajón así el generador no puede equilibrar el trabajo de aislamiento (no
 * distingue flexión de codo de extensión de codo) y el veto por lesión del §4.1
 * no puede vetar una articulación concreta sin vetar todo el aislamiento del
 * cuerpo. Los patrones de aislamiento se nombran por ARTICULACIÓN + ACCIÓN, que
 * es lo que un veto clínico necesita señalar.
 */
export enum MovementVector {
  // --- Multiarticulares ---------------------------------------------------
  PUSH_HORIZONTAL = 'PUSH_HORIZONTAL',
  PUSH_VERTICAL = 'PUSH_VERTICAL',
  PULL_HORIZONTAL = 'PULL_HORIZONTAL',
  PULL_VERTICAL = 'PULL_VERTICAL',
  KNEE_DOMINANT = 'KNEE_DOMINANT',
  HIP_DOMINANT = 'HIP_DOMINANT',
  /** Unilateral de rodilla: zancadas, búlgaras. Demanda de estabilidad distinta. */
  UNILATERAL_KNEE = 'UNILATERAL_KNEE',
  /** Transporte cargado: paseo del granjero. */
  LOADED_CARRY = 'LOADED_CARRY',

  // --- Aislamiento: codo --------------------------------------------------
  ELBOW_FLEXION = 'ELBOW_FLEXION',
  ELBOW_EXTENSION = 'ELBOW_EXTENSION',

  // --- Aislamiento: hombro ------------------------------------------------
  /** Abducción: elevación lateral. */
  SHOULDER_ABDUCTION = 'SHOULDER_ABDUCTION',
  /** Abducción horizontal: pájaros, pec deck invertido. */
  SHOULDER_HORIZONTAL_ABDUCTION = 'SHOULDER_HORIZONTAL_ABDUCTION',
  /** Aducción horizontal: cruces, pec deck. */
  SHOULDER_HORIZONTAL_ADDUCTION = 'SHOULDER_HORIZONTAL_ADDUCTION',
  /** Flexión: elevación frontal. */
  SHOULDER_FLEXION = 'SHOULDER_FLEXION',
  /** Extensión: pullover, extensión de hombro en polea. */
  SHOULDER_EXTENSION = 'SHOULDER_EXTENSION',
  /** Elevación escapular: encogimientos. */
  SCAPULAR_ELEVATION = 'SCAPULAR_ELEVATION',

  // --- Aislamiento: rodilla y cadera --------------------------------------
  KNEE_EXTENSION = 'KNEE_EXTENSION',
  KNEE_FLEXION = 'KNEE_FLEXION',
  /** Extensión de cadera aislada: patada de glúteo. */
  HIP_EXTENSION_ISOLATED = 'HIP_EXTENSION_ISOLATED',
  HIP_ABDUCTION = 'HIP_ABDUCTION',
  HIP_ADDUCTION = 'HIP_ADDUCTION',

  // --- Aislamiento: tobillo -----------------------------------------------
  ANKLE_PLANTAR_FLEXION = 'ANKLE_PLANTAR_FLEXION',
  ANKLE_DORSIFLEXION = 'ANKLE_DORSIFLEXION',

  // --- Aislamiento: columna y core ----------------------------------------
  SPINAL_FLEXION = 'SPINAL_FLEXION',
  SPINAL_EXTENSION = 'SPINAL_EXTENSION',
  /** Antiextensión y antirrotación: plancha, Pallof press. */
  CORE_ANTI_MOVEMENT = 'CORE_ANTI_MOVEMENT',
}

/** Patrones multiarticulares, para equilibrar la estructura de la sesión. */
export const COMPOUND_VECTORS: readonly MovementVector[] = [
  MovementVector.PUSH_HORIZONTAL,
  MovementVector.PUSH_VERTICAL,
  MovementVector.PULL_HORIZONTAL,
  MovementVector.PULL_VERTICAL,
  MovementVector.KNEE_DOMINANT,
  MovementVector.HIP_DOMINANT,
  MovementVector.UNILATERAL_KNEE,
  MovementVector.LOADED_CARRY,
];

/**
 * Pares de patrones ANTAGONISTAS. El generador los usa para no producir sesiones
 * desequilibradas (tres empujes y ninguna tracción), que es una causa conocida de
 * problemas de hombro a medio plazo.
 */
export const ANTAGONIST_PAIRS: readonly (readonly [MovementVector, MovementVector])[] = [
  [MovementVector.PUSH_HORIZONTAL, MovementVector.PULL_HORIZONTAL],
  [MovementVector.PUSH_VERTICAL, MovementVector.PULL_VERTICAL],
  [MovementVector.KNEE_DOMINANT, MovementVector.HIP_DOMINANT],
  [MovementVector.KNEE_EXTENSION, MovementVector.KNEE_FLEXION],
  [MovementVector.ELBOW_FLEXION, MovementVector.ELBOW_EXTENSION],
  [MovementVector.SHOULDER_HORIZONTAL_ADDUCTION, MovementVector.SHOULDER_HORIZONTAL_ABDUCTION],
  [MovementVector.SPINAL_FLEXION, MovementVector.SPINAL_EXTENSION],
];

/**
 * Perfil biomecánico del ejercicio. Determina la ponderación w_i del MPI
 * (PRD §3.2.2), el RIR de inicio/tope (PRD §3.4) y el descanso por defecto (PRD §3.4).
 */
export enum ExerciseProfile {
  /** Multiarticular primario/axial: banca plana, sentadilla, peso muerto. w=0.50, RIR conservador. */
  COMPOUND_PRIMARY = 'COMPOUND_PRIMARY',
  /** Multiarticular secundario/guiado: press inclinado mancuernas, hack, prensas, jalones. w=0.35. */
  COMPOUND_SECONDARY = 'COMPOUND_SECONDARY',
  /** Aislamiento: cruces en polea, extensiones. w=0.15, progresa hasta el fallo. */
  ISOLATION = 'ISOLATION',
}

/**
 * Material necesario. Permite al usuario declarar de qué dispone y excluir del
 * generador lo que no puede ejecutar: sugerir prensa a quien entrena en casa
 * hace inservible la propuesta.
 */
export enum Equipment {
  BARBELL = 'BARBELL',
  DUMBBELL = 'DUMBBELL',
  MACHINE = 'MACHINE',
  CABLE = 'CABLE',
  SMITH_MACHINE = 'SMITH_MACHINE',
  BODYWEIGHT = 'BODYWEIGHT',
  KETTLEBELL = 'KETTLEBELL',
  BANDS = 'BANDS',
}

/** Score on one audited criterion, 1 to 5. */
export type CriterionScore = 1 | 2 | 3 | 4 | 5;

/**
 * Biomechanical audit of an exercise, six criteria scored 1 to 5.
 *
 * Replaces the single hand-assigned effectiveness score the catalogue used to
 * carry. One number cannot express both how good an exercise is and how expensive
 * it is: a back squat loads the target muscle at full stretch AND drains central
 * recovery, and an engine that collapses the two prescribes blocks that degrade
 * performance before they end.
 *
 * Note the direction of the two cost criteria: for `stabilityCost` and
 * `systemicFatigueCost`, 5 is GOOD (stability does not limit force delivery,
 * fatigue is minimal). Every criterion therefore reads "higher is better".
 *
 * Confidence, citations and the reasoning behind each score live in
 * `src/data/exercise-evidence.json`, deliberately outside this type: the algorithm
 * consumes the numbers, the interface consumes the prose.
 */
export interface ExerciseCriteria {
  /** Mechanical tension resisted at maximum physiological sarcomere elongation. */
  stretchedPositionLoading: CriterionScore;
  /** Angular range over which the target muscle keeps active tension. */
  rangeOfMotion: CriterionScore;
  /** Agreement between the implement's resistance curve and the joint's force curve. */
  resistanceProfileMatch: CriterionScore;
  /** 5 = stability does NOT limit force delivery; 1 = balance is the limiter. */
  stabilityCost: CriterionScore;
  /** How finely and reproducibly external load can be increased over time. */
  loadProgressability: CriterionScore;
  /** 5 = minimal central, axial and joint fatigue per set; 1 = massive. */
  systemicFatigueCost: CriterionScore;
}

/**
 * Whether the automatic generator should normally consider an exercise.
 *
 * `FALLBACK` does not mean unsafe or ineffective. It means that, when a standard
 * alternative for the same programming problem is available, the generator
 * should prefer the easier-to-progress, easier-to-dose option. The exercise
 * remains available for manual routines and equipment-constrained plans.
 */
export enum ExerciseGenerationTier {
  STANDARD = 'STANDARD',
  FALLBACK = 'FALLBACK',
}

/**
 * Definición de un ejercicio en el catálogo (nativo o personalizado por el usuario).
 * Los ejercicios personalizados (PRD §3.5.3) solo requieren name + primaryMuscle
 * y carecen de mapeo biomecánico profundo (isCustom = true).
 */
export interface Exercise {
  id: string;
  name: string;
  primaryMuscle: MuscleGroup;
  secondaryMuscles: MuscleGroup[];
  movementVector: MovementVector;
  profile: ExerciseProfile;
  /** Material necesario, para filtrar por disponibilidad. */
  equipment: Equipment;
  /**
   * Biomechanical audit. Absent on user-created exercises, which fall back to a
   * neutral profile rather than being assumed good or bad.
   */
  criteria?: ExerciseCriteria;
  /** Automatic-selection policy; absent custom entries default to STANDARD. */
  generationTier?: ExerciseGenerationTier;
  /**
   * Programming dimensions used to prefer complementary variants (for example
   * shoulder position, grip and resistance emphasis). Tags use `AXIS:VALUE`.
   */
  stimulusTags?: string[];
  /**
   * Ilustraciones del patrón: inicio y final de la fase concéntrica.
   * Opcional a propósito: el catálogo es utilizable sin ellas y se añaden por
   * lotes sin migrar datos.
   */
  illustration?: {
    /** Posición inicial. */
    start: string;
    /** Final de la concéntrica. */
    end: string;
  };
  /** Ejercicio creado por el usuario sin taxonomía completa (PRD §3.5.3). */
  isCustom: boolean;
  /** userId si es personalizado; ausente en el catálogo global. */
  ownerId?: string;
}
