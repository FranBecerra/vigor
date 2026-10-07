/**
 * Resumen de una sesión planificada — LÓGICA PURA (PRD §8.5, §8.7).
 *
 * Calcula lo que la tarjeta de "hoy" y la hoja de previsualización necesitan
 * mostrar sin abrir el entrenamiento: series por grupo muscular, series totales
 * y duración estimada.
 *
 * ATRIBUCIÓN FRACCIONADA DE SERIES
 * Una serie de press banca no aporta lo mismo al pecho que al tríceps. El
 * músculo principal recibe la serie completa y cada secundario una fracción, de
 * ahí que los recuentos salgan decimales (`12.4 series`). Es un concepto
 * DISTINTO de `PROFILE_WEIGHT` (services/analytics/mpi), que pondera el perfil
 * del ejercicio para el MPI: aquí se reparte volumen entre músculos, allí se
 * pondera la contribución de un ejercicio al progreso.
 */
import { SetType, type MuscleGroup } from '@/models';
import { exerciseDurationBreakdown, SESSION_OVERHEAD_MINUTES } from './sessionDuration';
export { WORK_SECONDS_PER_SET } from './sessionDuration';

/**
 * Fracción de serie que se atribuye a cada músculo SECUNDARIO.
 *
 * 0.5 es la convención habitual en planificación de hipertrofia: un secundario
 * recibe aproximadamente la mitad del estímulo del principal.
 */
export const SECONDARY_MUSCLE_WEIGHT = 0.5;

/** Segundos de trabajo efectivo estimados por serie (para la duración). */

/** Ejercicio planificado, reducido a lo que necesita el resumen. */
export interface PlannedExercise {
  exerciseId: string;
  primaryMuscle: MuscleGroup;
  secondaryMuscles: readonly MuscleGroup[];
  /** Series de la sesión, en orden. */
  sets: readonly { setType: SetType; targetRIR?: number }[];
  /** Descanso prescrito entre series, en segundos. */
  restSeconds: number;
  /** RIR objetivo de la sesión/microciclo, para calcular intensidad media. */
  targetRIR: number;
}

/**
 * Series de TRABAJO: excluye los calentamientos, que no cuentan como volumen
 * efectivo aunque ocupen tiempo.
 */
export function countWorkingSets(sets: readonly { setType: SetType }[]): number {
  return sets.filter((s) => s.setType !== SetType.WARMUP).length;
}

/**
 * Series atribuidas a cada grupo muscular, con fracciones para los secundarios.
 *
 * Un músculo que aparece como principal en un ejercicio y secundario en otro
 * acumula ambas contribuciones. Un músculo repetido dentro de la lista de
 * secundarios del MISMO ejercicio solo cuenta una vez, para no inflar el
 * volumen por un dato mal introducido.
 */
export function muscleSetVolume(
  exercises: readonly PlannedExercise[],
): Record<string, number> {
  const volume: Record<string, number> = {};

  for (const exercise of exercises) {
    const working = countWorkingSets(exercise.sets);
    if (working === 0) continue;

    volume[exercise.primaryMuscle] = (volume[exercise.primaryMuscle] ?? 0) + working;

    const uniqueSecondaries = new Set(exercise.secondaryMuscles);
    // El principal nunca se cuenta además como secundario.
    uniqueSecondaries.delete(exercise.primaryMuscle);
    for (const muscle of uniqueSecondaries) {
      volume[muscle] = (volume[muscle] ?? 0) + working * SECONDARY_MUSCLE_WEIGHT;
    }
  }

  return volume;
}

/** Un grupo muscular con su volumen atribuido. */
export interface MuscleVolumeEntry {
  muscle: string;
  sets: number;
}

/**
 * Grupos musculares ordenados por volumen descendente. El desempate es
 * alfabético por clave, para que el orden sea ESTABLE entre renders (sin esto,
 * dos músculos con el mismo volumen podrían intercambiarse).
 */
export function rankedMuscleVolume(
  exercises: readonly PlannedExercise[],
  limit?: number,
): MuscleVolumeEntry[] {
  const volume = muscleSetVolume(exercises);
  const entries = Object.entries(volume)
    .map(([muscle, sets]) => ({ muscle, sets }))
    .sort((a, b) => (b.sets - a.sets) || a.muscle.localeCompare(b.muscle));
  return limit === undefined ? entries : entries.slice(0, limit);
}

/** Series totales de la sesión, incluidos los calentamientos (ocupan tiempo). */
export function totalSets(exercises: readonly PlannedExercise[]): number {
  return exercises.reduce((sum, e) => sum + e.sets.length, 0);
}

/** Series de trabajo de toda la sesión. */
export function totalWorkingSets(exercises: readonly PlannedExercise[]): number {
  return exercises.reduce((sum, e) => sum + countWorkingSets(e.sets), 0);
}

/**
 * Shared conservative duration: work, rest allowance, setup and warm-up.
 * Uses the same model as generation so home and preview cannot disagree.
 */
export function estimateSessionMinutes(exercises: readonly PlannedExercise[]): number {
  const work = exercises.reduce((sum, exercise) => sum + exerciseDurationBreakdown(
    exercise.sets.length, exercise.restSeconds, Math.ceil(exercise.sets.length / 4),
  ).total, 0);
  return work === 0 ? 0 : Math.round(work + SESSION_OVERHEAD_MINUTES);
}

/** Formatea un volumen fraccionado: `12` entero, `12.5` con decimal. */
export function formatSetVolume(sets: number): string {
  return Number.isInteger(sets) ? String(sets) : sets.toFixed(1);
}

/**
 * How many wrapped chips to show inside a fixed-height area, given each chip's measured
 * bottom edge in reading order. When some overflow, one slot is freed for the "+N" chip.
 */
export function visibleChipCount(bottoms: readonly number[], areaHeight: number): number {
  const fitting = bottoms.filter((bottom) => bottom <= areaHeight + 0.5).length;
  return fitting === bottoms.length ? fitting : Math.max(0, fitting - 1);
}
