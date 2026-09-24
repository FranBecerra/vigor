/**
 * Perfil de ENTRENAMIENTO del atleta (PRD §3.6).
 *
 * Separado de `UserProfile` a propósito: ese guarda identidad y datos generales;
 * esto son los parámetros que alimentan el generador de mesociclos. Mezclarlos
 * obligaría a leer el perfil entero para generar una rutina.
 */
import type { Timestampish } from './common';
import type { Equipment, MuscleGroup } from './biomechanics';

/**
 * Nivel de experiencia. Determina los valores de MAV y MRV por defecto, de los
 * que se infiere el MEAV del mesociclo (PRD §3).
 *
 * Se declara por años de entrenamiento continuado, no por fuerza absoluta: la
 * capacidad de tolerar volumen depende de la exposición acumulada, no de cuánto
 * levantas.
 */
export enum ExperienceLevel {
  /** Menos de ~1 año. Tolera poco volumen y progresa con poco estímulo. */
  BEGINNER = 'BEGINNER',
  /** ~1-3 años. */
  INTERMEDIATE = 'INTERMEDIATE',
  /** Más de ~3 años con progresión consistente. */
  ADVANCED = 'ADVANCED',
}

/** Escala con la que el atleta prefiere expresar la intensidad (PRD §8.7). */
export type IntensityScalePreference = 'RIR' | 'RPE';

/** Unidad de peso preferida. `auto` sigue la región del dispositivo. */
export type WeightUnitPreference = 'auto' | 'kg' | 'lb';

/**
 * Estructura de reparto de la semana de entrenamiento. Entrada principal del
 * generador: define qué grupos musculares entrena cada sesión.
 */
export enum SplitStructure {
  /** Cuerpo completo en cada sesión. */
  FULL_BODY = 'FULL_BODY',
  /** Torso / pierna. */
  UPPER_LOWER = 'UPPER_LOWER',
  /** Empuje / tracción / pierna. */
  PUSH_PULL_LEGS = 'PUSH_PULL_LEGS',
  /** Empuje / tracción / pierna / torso. */
  PUSH_PULL_LEGS_UPPER = 'PUSH_PULL_LEGS_UPPER',
  /** El generador elige la estructura que mejor reparte el volumen disponible. */
  AUTO = 'AUTO',
}

/**
 * Volumen semanal declarado por el atleta para un grupo muscular, en SERIES.
 *
 * Alternativa a estimar desde el nivel de experiencia: si el atleta sabe cuánto
 * volumen viene haciendo, ese dato es mejor que cualquier tabla, porque describe
 * su tolerancia real y no un promedio poblacional.
 */
export type DeclaredVolumeByMuscle = Partial<Record<MuscleGroup, number>>;

export interface AthleteTrainingProfile {
  id: string;
  userId: string;

  /** Nivel de experiencia, base del cálculo de MAV/MRV. */
  experienceLevel: ExperienceLevel;

  /**
   * Sesiones que el atleta puede encajar por microciclo.
   *
   * Junto con `sessionLength` forma el techo de TIEMPO, que suele ser el que
   * limita de verdad el volumen y a menudo por mucho: un intermedio recupera 84
   * series por microciclo, pero en tres sesiones de una hora no le caben ni la
   * mitad. Sin este dato el generador prescribe rutinas que el atleta no puede
   * terminar, y las abandona por falta de tiempo y no por falta de recuperación.
   */
  sessionsPerMicrocycle: number;

  /**
   * Minutos de los que dispone por sesión, escritos por el atleta.
   *
   * Un número y no un tramo cerrado: es el propio atleta quien sabe si tiene 40 o
   * 75 minutos, y al algoritmo le da igual la cifra. Un tramo obligaba además a
   * decidir con qué extremo planificar, que es una decisión que no hay que tomar
   * si el dato es exacto.
   *
   * Un valor absurdamente bajo no se corrige en silencio: el planificador
   * responde `insufficient-time`, que es información útil. Uno absurdamente alto
   * queda acotado por el techo de recuperación.
   */
  minutesPerSession: number;

  /**
   * Structure used to distribute the plan across microcycle sessions.
   *
   * It does not change target volume: when volume is equated, evidence does not
   * show a consistent full-body versus split advantage. It does determine where
   * each exercise can fit, so it persists with the capacity used to generate a
   * proposal.
   */
  splitStructure: SplitStructure;

  /**
   * Volumen que el atleta declara estar haciendo recientemente, por músculo.
   * Cuando existe, PREVALECE sobre la estimación por nivel de experiencia.
   */
  recentVolumeByMuscle?: DeclaredVolumeByMuscle;

  /** Material del que dispone. El generador no propone lo que no puede ejecutar. */
  availableEquipment: Equipment[];

  /**
   * Ejercicios que el atleta NO quiere recibir: no le gustan, le molestan, o no
   * los tiene en su gimnasio. El generador los excluye por completo.
   *
   * Se guarda como lista de vetos explícitos y no como "material no disponible"
   * porque son cosas distintas: se puede tener la máquina y aun así no querer el
   * ejercicio.
   */
  vetoedExerciseIds: string[];

  /**
   * Grupos musculares a PRIORIZAR: su región recibe volumen entre el MAV y el
   * MRV, y el resto baja al mínimo efectivo para compensar. El tope no es
   * arbitrario: el volumen total está acotado por lo que el atleta puede
   * recuperar, así que priorizar todo no prioriza nada.
   *
   * Dos regiones de alto coste de recuperación, o hasta tres cuando alguna es de
   * bajo coste (brazos, gemelos, deltoides). `assertEmphasisLimits` lo valida.
   */
  priorityMuscles: MuscleGroup[];

  /**
   * Grupos musculares a DESPRIORIZAR: su región baja a volumen de mantenimiento.
   * Hasta tres. Es lo que libera recuperación para lo priorizado.
   */
  deprioritizedMuscles: MuscleGroup[];

  /** Escala de intensidad preferida (§8.7). */
  intensityScale: IntensityScalePreference;

  /** Unidad de peso preferida. El almacenamiento canónico sigue siendo kg. */
  weightUnit: WeightUnitPreference;

  createdAt: Timestampish;
  updatedAt: Timestampish;
}
