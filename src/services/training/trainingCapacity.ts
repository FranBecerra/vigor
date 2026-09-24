/**
 * Capacidad de entrenamiento: cuánto puede entrenar el atleta de verdad.
 * LÓGICA PURA (PRD §3.6).
 *
 * POR QUÉ EXISTE
 *   El volumen tiene DOS techos y manda el más bajo:
 *     - RECUPERACIÓN: el MRV y el rango de volumen total del nivel. Es el que
 *       modela `volumePlan.ts`.
 *     - TIEMPO: las sesiones que caben en su semana y los minutos de cada una.
 *
 *   El de tiempo suele ser el que limita de verdad, y por mucho. Un intermedio
 *   recupera 84 series por microciclo, pero si solo puede entrenar tres veces una
 *   hora no le caben: el hueco es de más de la mitad. Prescribirle el plan de
 *   recuperación produce una rutina que abandona a la tercera sesión, no porque no
 *   la recupere sino porque no le da tiempo a acabarla.
 *
 * MODELO DE TIEMPO
 *   Reutiliza `WORK_SECONDS_PER_SET` de `sessionSummary.ts` y `restDurationFor`
 *   de `restTimer.ts` a propósito: son los mismos números con los que la app
 *   cronometra la sesión y estima su duración. Un segundo modelo de tiempo
 *   acabaría contradiciendo al primero, y el atleta vería una estimación en la
 *   pantalla de sesión que no cuadra con la que usó el generador.
 *
 *   La estimación tira a LARGO (cuenta descanso tras cada serie, incluida la
 *   última de cada ejercicio). Equivocarse por exceso significa prescribir algo de
 *   menos y acabar antes; por defecto significa dejar la sesión a medias.
 */
import { ExerciseProfile, type Exercise } from '@/models';
import { restDurationFor } from './restTimer';
import { WORK_SECONDS_PER_SET } from './sessionSummary';

export interface TrainingCapacity {
  /**
   * Sesiones por microciclo. Es el número FIJO del §3.1: el microciclo se mide en
   * sesiones, no en días, así que esto es cuántas sesiones puede encajar, no en
   * qué días de la semana.
   */
  sessionsPerMicrocycle: number;
  /**
   * Minutos de los que dispone el atleta en cada sesión.
   *
   * Lo escribe él, así que no hay tramos ni hay que elegir con qué extremo
   * planificar. Un tiempo insuficiente se reporta como tal en lugar de ajustarse.
   */
  minutesPerSession: number;
}

/**
 * Minutos de puesta en marcha de cada sesión: calentamiento general, movilidad y
 * las series de aproximación del primer ejercicio. No producen volumen pero
 * consumen tiempo, y no contarlos es la forma más fácil de prescribir una sesión
 * que no cabe.
 */
export const SESSION_OVERHEAD_MINUTES = 6;

/**
 * Segundos de montaje de cada ejercicio dentro de una sesión: buscar el hueco,
 * ajustar la máquina y las series de aproximación propias.
 */
export const EXERCISE_SETUP_SECONDS = 60;

/**
 * Maximum work sets for one exercise appearance in a session.
 *
 * The real session distribution enforces this limit. Capacity calculations keep
 * it to estimate appearances when called before a distribution is available.
 */
export const MAX_SETS_PER_EXERCISE_APPEARANCE = 3;

/** Minutos totales disponibles en el microciclo, descontada la puesta en marcha. */
export function workMinutesAvailable(capacity: TrainingCapacity): number {
  const perSession = capacity.minutesPerSession - SESSION_OVERHEAD_MINUTES;
  return Math.max(0, perSession * Math.max(0, capacity.sessionsPerMicrocycle));
}

/** Cuántas veces aparece un ejercicio a lo largo del microciclo. */
export function appearancesOf(sets: number): number {
  return Math.max(1, Math.ceil(sets / MAX_SETS_PER_EXERCISE_APPEARANCE));
}

/** Minutos que cuesta un ejercicio con sus series, montaje incluido. */
export function exerciseMinutes(exercise: Exercise, sets: number): number {
  if (sets <= 0) return 0;
  const seconds =
    appearancesOf(sets) * EXERCISE_SETUP_SECONDS +
    sets * (WORK_SECONDS_PER_SET + restDurationFor(exercise.profile));
  return seconds / 60;
}

/** Minutos de trabajo que cuesta una selección completa. */
export function selectionMinutes(
  selected: readonly { exercise: Exercise; sets: number }[],
): number {
  return selected.reduce((sum, entry) => sum + exerciseMinutes(entry.exercise, entry.sets), 0);
}

/**
 * Volumen ATRIBUIDO que rinde un ejercicio por minuto invertido.
 *
 * Es la medida de eficiencia que gobierna la selección cuando el techo es el
 * tiempo: un remo con barra acredita 3 series (1 al dorsal más 0,5 a cada uno de
 * sus cuatro secundarios) en los mismos 220 s que una extensión de cuádriceps
 * acredita 1. Con una hora al día esa diferencia decide la rutina.
 */
export function attributedVolumePerMinute(exercise: Exercise): number {
  const attributed = 1 + exercise.secondaryMuscles.length * 0.5;
  const minutesPerSet = (WORK_SECONDS_PER_SET + restDurationFor(exercise.profile)) / 60;
  return attributed / minutesPerSet;
}

/**
 * Referencia de eficiencia: un ejercicio de aislamiento puro, sin secundarios.
 * Es el suelo con el que se comparan los demás.
 */
export const ISOLATION_VOLUME_PER_MINUTE =
  1 / ((WORK_SECONDS_PER_SET + restDurationFor(ExerciseProfile.ISOLATION)) / 60);

/**
 * Series de trabajo que caben en la capacidad, como referencia rápida.
 *
 * Asume una mezcla de multiarticulares y aislamiento, así que es una orientación
 * para mostrar en pantalla, no el criterio con el que se recorta el plan: eso se
 * mide sobre los ejercicios realmente elegidos, que tienen descansos distintos.
 */
export function approximateSetCapacity(capacity: TrainingCapacity): number {
  const averageRest =
    (restDurationFor(ExerciseProfile.COMPOUND_PRIMARY) +
      restDurationFor(ExerciseProfile.ISOLATION)) /
    2;
  const perSetSeconds =
    WORK_SECONDS_PER_SET + averageRest + EXERCISE_SETUP_SECONDS / MAX_SETS_PER_EXERCISE_APPEARANCE;
  return Math.floor((workMinutesAvailable(capacity) * 60) / perSetSeconds);
}
