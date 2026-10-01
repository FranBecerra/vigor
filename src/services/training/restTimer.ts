/**
 * Temporizador de descanso entre series — LÓGICA PURA (PRD §3.4).
 *
 * REGLA ÚNICA:
 *   El temporizador se reinicia cuando una serie pasa a completada Y ninguna
 *   serie POSTERIOR está ya completada. Ninguna otra acción lo toca.
 *
 * Dicho de otro modo: el temporizador solo reacciona a la serie que está en la
 * FRONTERA del progreso del usuario. Consecuencias (todas deseadas):
 *  - Completar series en orden arranca el descanso cada vez, con la duración
 *    correspondiente al ejercicio.
 *  - Desmarcar y volver a marcar la ÚLTIMA serie lo reinicia: no hay ninguna
 *    serie posterior completada, así que sigue siendo la frontera.
 *  - Recompletar una serie ANTERIOR tras corregir un dato NO lo reinicia: hay
 *    series posteriores ya completadas, luego es una corrección y no trabajo
 *    nuevo. El descanso en curso se conserva.
 *  - Desmarcar cualquier serie NUNCA toca el temporizador.
 *
 * El estado guarda el INSTANTE de inicio, no los segundos restantes: así el
 * tiempo transcurrido se deriva del reloj y no se desvía aunque la interfaz se
 * repinte de forma irregular o la app quede en segundo plano.
 */
import { ExerciseProfile } from '@/models';

/** Duración mínima y máxima admitidas al ajustar el descanso, en segundos. */
export const MIN_REST_SECONDS = 0;
export const MAX_REST_SECONDS = 3600;

/** Paso de los botones de ajuste rápido (+10 / −10). */
export const REST_STEP_SECONDS = 10;

export interface RestTimerState {
  /** Instante (ms epoch) en que arrancó el descanso. `null` = sin temporizador. */
  startedAt: number | null;
  /** Duración total del descanso en segundos. */
  durationSeconds: number;
  /** Id de la serie que ancla este descanso (la última completada). */
  anchorSetId: string | null;
}

/** Estado inicial: sin descanso en curso. */
export const IDLE_REST_TIMER: RestTimerState = {
  startedAt: null,
  durationSeconds: 0,
  anchorSetId: null,
};

/**
 * Recommended rest by exercise profile (PRD §3.4).
 *
 * Three tiers, not two. The previous model lumped COMPOUND_PRIMARY and
 * COMPOUND_SECONDARY together at 180 s, which is a strength-training rest rather
 * than a hypertrophy one, and it made the whole time model too conservative: the
 * planner concluded that one hour fits 15-16 sets when 18 is unremarkable.
 *
 * These are timer defaults, not a promise of session duration. The capacity
 * planner adds a conservative floor for transitions and other gym delays.
 *
 * The athlete can always extend a rest from the timer; what matters here is that
 * the planning assumption matches what actually happens in the gym.
 */
export function restDurationFor(profile: ExerciseProfile): number {
  if (profile === ExerciseProfile.COMPOUND_PRIMARY) return 150;
  if (profile === ExerciseProfile.COMPOUND_SECONDARY) return 120;
  return 90;
}

/**
 * Arranca (o reinicia) el descanso anclado a una serie.
 * Es la ÚNICA transición que pone en marcha el temporizador.
 */
export function startRest(
  setId: string,
  durationSeconds: number,
  nowMs: number,
): RestTimerState {
  return {
    startedAt: nowMs,
    durationSeconds: clampDuration(durationSeconds),
    anchorSetId: setId,
  };
}

/** Segundos restantes, nunca negativo. 0 si no hay temporizador. */
export function remainingSeconds(state: RestTimerState, nowMs: number): number {
  if (state.startedAt === null) return 0;
  const elapsed = Math.floor((nowMs - state.startedAt) / 1000);
  return Math.max(0, state.durationSeconds - elapsed);
}

/** true cuando hay un descanso activo y ya se ha agotado. */
export function isRestFinished(state: RestTimerState, nowMs: number): boolean {
  return state.startedAt !== null && remainingSeconds(state, nowMs) === 0;
}

/** true cuando hay un descanso en curso (aún con tiempo restante). */
export function isRestRunning(state: RestTimerState, nowMs: number): boolean {
  return state.startedAt !== null && remainingSeconds(state, nowMs) > 0;
}

/** Acota una duración al rango admitido. */
export function clampDuration(seconds: number): number {
  if (!Number.isFinite(seconds)) return MIN_REST_SECONDS;
  return Math.min(MAX_REST_SECONDS, Math.max(MIN_REST_SECONDS, Math.round(seconds)));
}

/**
 * Suma (o resta) segundos al descanso en curso SIN mover el instante de inicio:
 * el tiempo ya transcurrido se conserva, solo cambia el total.
 * Sin temporizador activo, no hace nada.
 */
export function adjustRest(state: RestTimerState, deltaSeconds: number): RestTimerState {
  if (state.startedAt === null) return state;
  return { ...state, durationSeconds: clampDuration(state.durationSeconds + deltaSeconds) };
}

/** Fija una duración absoluta, conservando el instante de inicio. */
export function setRestDuration(state: RestTimerState, seconds: number): RestTimerState {
  if (state.startedAt === null) return state;
  return { ...state, durationSeconds: clampDuration(seconds) };
}

/** Reinicia el descanso en curso desde cero, con la misma duración y ancla. */
export function restartRest(state: RestTimerState, nowMs: number): RestTimerState {
  if (state.startedAt === null) return state;
  return { ...state, startedAt: nowMs };
}

/** Cancela el descanso (acción explícita del usuario, nunca automática). */
export function cancelRest(): RestTimerState {
  return IDLE_REST_TIMER;
}

/** Formatea segundos como `m:ss` (o `h:mm:ss` si pasa de una hora). */
export function formatRest(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  const paddedSeconds = String(seconds).padStart(2, '0');
  if (hours > 0) return `${hours}:${String(minutes).padStart(2, '0')}:${paddedSeconds}`;
  return `${minutes}:${paddedSeconds}`;
}

/** Serie reducida a lo que necesita la decisión de reinicio. */
export interface OrderedSet {
  id: string;
  isCompleted: boolean;
}

/**
 * Aplana las series en ORDEN DE SESIÓN: los ejercicios en el orden dado y, dentro
 * de cada uno, sus series en su propio orden. Ese orden es lo que define qué
 * serie es "posterior" a otra.
 *
 * Los ejercicios sin series registradas simplemente no aportan nada.
 */
export function flattenSessionSets<T extends OrderedSet>(
  exerciseOrder: readonly string[],
  setsByExercise: Readonly<Record<string, readonly T[]>>,
): OrderedSet[] {
  const flat: OrderedSet[] = [];
  for (const exerciseId of exerciseOrder) {
    for (const s of setsByExercise[exerciseId] ?? []) {
      flat.push({ id: s.id, isCompleted: s.isCompleted });
    }
  }
  return flat;
}

/**
 * Decide si completar `completedSetId` debe reiniciar el descanso.
 *
 * Solo lo reinicia si esa serie está en la FRONTERA del progreso, es decir si
 * ninguna serie posterior en el orden de sesión está ya completada. Así,
 * recompletar una serie anterior después de corregir un dato no destruye el
 * descanso en curso.
 *
 * `orderedSets` debe reflejar el estado YA con la serie marcada como completada.
 * Una serie que no aparezca en la lista devuelve `false` (defensivo).
 */
export function shouldRestartRest(
  orderedSets: readonly OrderedSet[],
  completedSetId: string,
): boolean {
  const index = orderedSets.findIndex((s) => s.id === completedSetId);
  if (index === -1) return false;
  return !orderedSets.slice(index + 1).some((s) => s.isCompleted);
}
