/**
 * Modelo de Sesión de Entrenamiento y Mesociclos.
 * Fuente de verdad: PRD.md §6 (modelo 2), §3.1 (arquitectura del mesociclo),
 * §3.4 (autorregulación RIR y ejecución).
 */
import type { Timestampish } from './common';
import type { PlannedSession } from './routine';

/** Tipo de serie (PRD §6 modelo 2). */
export enum SetType {
  WARMUP = 'WARMUP',
  NORMAL = 'NORMAL',
  FAILURE = 'FAILURE',
  DROP_SET = 'DROP_SET',
  MYO_REP = 'MYO_REP',
  REST_PAUSE = 'REST_PAUSE',
  /**
   * One heavy repetition at RPE 7.5-8 before the working sets of a strength main
   * lift: exposure to a load close to the maximum without the fatigue of a max.
   */
  TOP_SINGLE = 'TOP_SINGLE',
}

/**
 * Estado del mesociclo (PRD §3.1, §3.3.3).
 * Los mesociclos NO tienen duración fija: evolucionan según biomarcadores.
 * INTERRUPTED = aborto manual que preserva el progreso (PRD §3.3.3).
 */
export type MesocycleStatus = 'ACTIVE' | 'DELOAD' | 'COMPLETED' | 'INTERRUPTED';

export interface Mesocycle {
  id: string;
  userId: string;
  status: MesocycleStatus;
  /**
   * Routine this mesocycle was instantiated from.
   *
   * Optional because mesocycles created before routines existed have none, and
   * because a one-off block the athlete built by hand is legitimate.
   */
  routineId?: string;
  /**
   * The PRESCRIPTION: which exercises and sets each session of the microcycle
   * performs.
   *
   * It lives here and not on each Microcycle because volume is STATIC within a
   * mesocycle (§3): every microcycle runs the same exercises and sets, varying
   * only in intensity, which `deriveSetRIRs` computes. Storing it per microcycle
   * would duplicate identical data and invite the copies to drift apart.
   *
   * Embedded rather than a separate collection because it is bounded by
   * `sessionsPerMicrocycle`, a few kilobytes, and loading a mesocycle should not
   * need a second round trip while offline.
   */
  plannedSessions?: PlannedSession[];
  /** MEAV inicial: volumen objetivo por grupo muscular (PRD §3, MuscleGroup -> nº series). */
  targetVolumePerGroup: Record<string, number>;
  /** Índice del microciclo actualmente en curso dentro del mesociclo (0-based). */
  currentMicrocycleIndex: number;
  /**
   * Número de SESIONES que componen cada microciclo de este mesociclo.
   *
   * La estructura es UNIFORME: todos los microciclos tienen SIEMPRE el mismo
   * número de sesiones, y varían solo en intensidad (y ligeramente en volumen).
   *
   * El microciclo se define por sus sesiones, nunca por el calendario. No hay
   * duración en días en ningún nivel del modelo: que una sesión se retrase o que
   * el usuario intercale descansos no se refleja.
   */
  sessionsPerMicrocycle: number;
  /** Horizonte estimado (no determinista) en nº de microciclos, para el roadmap (PRD §3.1). */
  projectedMicrocycles?: number;
  startedAt: Timestampish;
  updatedAt: Timestampish;
}

/**
 * Microciclo: bloque de N días dentro de un mesociclo (habitualmente 7, pero
 * admite 7, 8, 9... días según la estructura del entreno). Sustituye a la
 * antigua noción de "semana fija" para no forzar bloques de 7 días.
 */
export interface Microcycle {
  id: string;
  userId: string;
  mesocycleId: string;
  /** Posición dentro del mesociclo (0-based). */
  index: number;
  /**
   * NO existe duración en días, ni planificada ni derivada.
   *
   * El microciclo se define EXCLUSIVAMENTE por sus sesiones, y todos los
   * microciclos de un mesociclo tienen el mismo número de sesiones
   * (ver Mesocycle.sessionsPerMicrocycle). Que el usuario tarde dos días más en
   * completar uno es asunto suyo: el sistema no lo modela ni lo muestra.
   *
   * startedAt/completedAt existen para ordenar el histórico, no para calcular
   * una duración que se presente al usuario.
   */
  startedAt: Timestampish;
  completedAt?: Timestampish;
}

/**
 * Una serie concreta dentro de una sesión (PRD §6 modelo 2).
 * Los campos target* son la pauta; los actual* el registro real.
 * isAutoFilled marca la sugerencia a la baja del Fatigue Auto-fill (PRD §3.4).
 */
/**
 * Tramo ADICIONAL de una serie avanzada (PRD §8.8).
 *
 * Rest Pause, MyoReps y Drop Set no son una serie con un número de
 * repeticiones: son una serie principal MÁS una secuencia de tramos extra. Este
 * tipo registra cada uno de esos tramos, para no perder trabajo real que el
 * atleta sí ha hecho.
 *
 * Interpretación por tipo de serie:
 *  - REST_PAUSE  → mini-series tras una pausa breve, normalmente al MISMO peso.
 *  - MYO_REP     → mini-series tras la serie de activación, al mismo peso.
 *  - DROP_SET    → tramos con peso REDUCIDO, cada uno con el suyo.
 */
export interface SetExtension {
  /**
   * Repeticiones logradas en este tramo. Puede estar vacío mientras el atleta
   * lo está introduciendo en la sesión; al guardar una sesión completa debe ser
   * un número.
   */
  reps?: number;
  /**
   * Peso de ESTE tramo, en kg (unidad canónica).
   *
   * Se guarda absoluto, no como diferencia: así sirve igual para un Drop Set
   * (baja) que para cualquier tramo que suba, sin signos que interpretar.
   * `undefined` = se mantiene el peso de la serie principal, que es el caso
   * habitual en Rest Pause y MyoReps.
   */
  weight?: number;
}

export interface WorkoutSet {
  id: string;
  setType: SetType;
  targetReps: number;
  /**
   * RIR objetivo. Almacenamiento canónico en RIR; si el usuario prefiere RPE,
   * la conversión es de PRESENTACIÓN (ver services/training/intensityScale).
   */
  targetRIR: number;
  targetWeight: number;
  actualReps?: number;
  /**
   * RIR real registrado. Puede ser **null** = intensidad no registrada
   * (p. ej. en calentamientos donde no se sabe cuántas reps quedan).
   */
  actualRIR?: number | null;
  actualWeight?: number;
  /**
   * Tramos extra ejecutados, en orden, para series avanzadas (Rest Pause,
   * MyoReps, Drop Set). Ausente o vacío en una serie normal.
   *
   * `actualReps` sigue siendo las repeticiones de la serie PRINCIPAL; el total
   * real se obtiene sumando los tramos. Se mantienen separados a propósito: una
   * serie de 10 + 3 + 2 no es equivalente a una de 15 a efectos de estímulo.
   */
  extensions?: SetExtension[];
  isAutoFilled: boolean;
}

/** Un ejercicio ejecutado dentro de una sesión, con sus series. */
export interface WorkoutExercise {
  id: string;
  exerciseId: string;
  /** Orden en la sesión. */
  order: number;
  sets: WorkoutSet[];
  /** true si este ejercicio sustituyó al pautado vía motor de swap (PRD §3.5). */
  isSwap: boolean;
  /** exerciseId original si isSwap = true, para renormalizar pesos del MPI (PRD §3.2.3). */
  swappedFromExerciseId?: string;
}

/** Sesión de entrenamiento completa dentro de un microciclo del mesociclo. */
export interface WorkoutSession {
  id: string;
  userId: string;
  mesocycleId: string;
  microcycleId: string;
  /**
   * Index of the `PlannedSession` this session executed.
   *
   * Absent on a freely logged session with no prescription behind it. When present
   * it is what makes adherence measurable: prescribed sets and RIR against what
   * actually happened, instead of inferring the link from order or timing.
   */
  plannedSessionIndex?: number;
  /** Índice del microciclo dentro del mesociclo (denormalizado para consultas rápidas). */
  microcycleIndex: number;
  exercises: WorkoutExercise[];
  performedAt: Timestampish;
  completedAt?: Timestampish;
}

/**
 * Check-in de observabilidad al cerrar cada MICROCICLO (PRD §3.1).
 * Input ultrarrápido. Antes era "semanal"; ahora se ancla al microciclo, que
 * puede durar más de 7 días.
 */
export interface MicrocycleCheckIn {
  id: string;
  userId: string;
  mesocycleId: string;
  microcycleId: string;
  microcycleIndex: number;
  /** Promedio subjetivo de sueño, energía y motivación (1-10). */
  recoveryScore: number;
  /** Sensación articular, pesadez del SNC y cuadre de RPE. */
  fatigueScore: number;
  createdAt: Timestampish;
}
