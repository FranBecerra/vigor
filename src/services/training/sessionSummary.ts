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

/**
 * Fracción de serie que se atribuye a cada músculo SECUNDARIO.
 *
 * 0.5 es la convención habitual en planificación de hipertrofia: un secundario
 * recibe aproximadamente la mitad del estímulo del principal.
 */
export const SECONDARY_MUSCLE_WEIGHT = 0.5;

/** Segundos de trabajo efectivo estimados por serie (para la duración). */
export const WORK_SECONDS_PER_SET = 40;

/** Ejercicio planificado, reducido a lo que necesita el resumen. */
export interface PlannedExercise {
  exerciseId: string;
  primaryMuscle: MuscleGroup;
  secondaryMuscles: readonly MuscleGroup[];
  /** Series de la sesión, en orden. */
  sets: readonly { setType: SetType }[];
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
 * Duración estimada en minutos: trabajo efectivo más descansos.
 *
 * Se cuenta un descanso por serie EXCEPTO la última de cada ejercicio (tras la
 * última no se descansa: se pasa al siguiente ejercicio). Es una estimación
 * declarada como tal en la interfaz (`~62 min`), no una promesa.
 */
export function estimateSessionMinutes(exercises: readonly PlannedExercise[]): number {
  let seconds = 0;
  for (const exercise of exercises) {
    const count = exercise.sets.length;
    if (count === 0) continue;
    seconds += count * WORK_SECONDS_PER_SET;
    seconds += (count - 1) * exercise.restSeconds;
  }
  return Math.round(seconds / 60);
}

/** Formatea un volumen fraccionado: `12` entero, `12.5` con decimal. */
export function formatSetVolume(sets: number): string {
  return Number.isInteger(sets) ? String(sets) : sets.toFixed(1);
}
