/**
 * Taxonomía de Ejercicios y Biomecánica.
 * Fuente de verdad: PRD.md §6 (modelo 1), §3.5 (motor de sustitución), §4.1 (veto
 * biomecánico por lesión) y §3.6 (generador de mesociclos).
 */

/**
 * Exercise-selection muscle groups (PRD §3.5.2).
 *
 * Chest is deliberately one group: incline and flat pressing are useful stimulus
 * variants, not independently budgeted muscles. MID_BACK groups the scapular
 * retractors used by rows, while NECK covers cervical work and upper trapezius.
 */
export enum MuscleGroup {
  DELTS_FRONT = 'DELTS_FRONT',
  DELTS_LATERAL = 'DELTS_LATERAL',
  DELTS_REAR = 'DELTS_REAR',
  NECK = 'NECK',
  MID_BACK = 'MID_BACK',
  CHEST = 'CHEST',
  LATS = 'LATS',
  ERECTORS = 'ERECTORS',
  QUADS = 'QUADS',
  HAMSTRINGS = 'HAMSTRINGS',
  GLUTES = 'GLUTES',
  ADDUCTORS = 'ADDUCTORS',
  CALVES = 'CALVES',
  TIBIALIS = 'TIBIALIS',
  BICEPS = 'BICEPS',
  FOREARMS = 'FOREARMS',
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
  WRIST_FLEXION = 'WRIST_FLEXION',
  WRIST_EXTENSION = 'WRIST_EXTENSION',
  FOREARM_ROTATION = 'FOREARM_ROTATION',
  GRIP = 'GRIP',

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
  /** Dynamic cervical flexion against external resistance. */
  CERVICAL_FLEXION = 'CERVICAL_FLEXION',
  /** Dynamic cervical extension against external resistance. */
  CERVICAL_EXTENSION = 'CERVICAL_EXTENSION',
  /** Dynamic lateral cervical flexion against external resistance. */
  CERVICAL_LATERAL_FLEXION = 'CERVICAL_LATERAL_FLEXION',

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
 * Complementary task pairs used as programming preferences. They are not a
 * validated causal predictor of shoulder injury or a clinical prescription.
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
  /** Source does not specify the implement reliably; do not guess it. */
  UNSPECIFIED = 'UNSPECIFIED',
  BARBELL = 'BARBELL',
  SAFETY_BAR = 'SAFETY_BAR',
  TRAP_BAR = 'TRAP_BAR',
  LANDMINE = 'LANDMINE',
  DUMBBELL = 'DUMBBELL',
  MACHINE = 'MACHINE',
  CABLE = 'CABLE',
  SMITH_MACHINE = 'SMITH_MACHINE',
  BODYWEIGHT = 'BODYWEIGHT',
  ROMAN_CHAIR = 'ROMAN_CHAIR',
  STABILITY_BALL = 'STABILITY_BALL',
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
 * it is: a squat can combine lengthened muscle loading with demanding whole-body
 * work. These are expert programming assessments, not measured central fatigue.
 *
 * Note the direction of the two cost criteria: for `stabilityCost` and
 * `systemicFatigueCost`, 5 is GOOD (stability does not limit force delivery,
 * fatigue is minimal). Every criterion therefore reads "higher is better".
 *
 * The original catalogue has per-exercise evidence notes in
 * `src/data/exercise-evidence.json`. Guide imports use a page-linked, rule-based
 * rubric; neither source should be interpreted as a measured effect size.
 */
export interface ExerciseCriteria {
  /** Expert estimate of loading in a lengthened muscle position; not sarcomere measurement. */
  stretchedPositionLoading: CriterionScore;
  /** Angular range over which the target muscle keeps active tension. */
  rangeOfMotion: CriterionScore;
  /** Agreement between the implement's resistance curve and the joint's force curve. */
  resistanceProfileMatch: CriterionScore;
  /** 5 = stability does NOT limit force delivery; 1 = balance is the limiter. */
  stabilityCost: CriterionScore;
  /** How finely and reproducibly external load can be increased over time. */
  loadProgressability: CriterionScore;
  /** Expert programming estimate: 5 = lower systemic demand, 1 = higher. Not measured CNS fatigue. */
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
  /** Indexed for manual use; excluded from automatic programming pending role/credit review. */
  MANUAL_ONLY = 'MANUAL_ONLY',
  /**
   * A specific variant of a strength main lift (paused squat, deficit deadlift).
   * Prescribed by the strength program by id; never drawn by hypertrophy
   * selection, where it would only be a harder way to train the same muscle.
   */
  STRENGTH_VARIANT = 'STRENGTH_VARIANT',
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
   * Ordinal programming assessment. Absent on unscored manual-only imports and
   * user-created exercises. Only custom entries use the calculation fallback;
   * unscored guide entries must not acquire a fabricated neutral rating.
   */
  criteria?: ExerciseCriteria;
  /** Automatic-selection policy; absent custom entries default to STANDARD. */
  generationTier?: ExerciseGenerationTier;
  /** Physical page in the source guide; rubric scores are Vigor judgements. */
  guidePage?: number;
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
