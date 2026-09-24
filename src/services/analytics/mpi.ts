/**
 * MPI — Índice de Progreso Muscular ponderado por grupo (PRD §3.2).
 *
 *   MPI_Grupo = Σ(w_i · Δe1RM_i) / Σ(w_i)
 *
 * Ponderación biomecánica por perfil de ejercicio (PRD §3.2.2):
 *   COMPOUND_PRIMARY = 0.50, COMPOUND_SECONDARY = 0.35, ISOLATION = 0.15.
 *
 * Tolerancia a swaps (PRD §3.2.3): si un ejercicio se omite/sustituye, se
 * recalcula el conjunto de pesos normalizando Σw = 1 sobre los presentes, para
 * no distorsionar el índice. Aquí el divisor Σ(w_i) ya normaliza de forma
 * natural sobre los ejercicios presentes, sea cual sea su peso.
 *
 * Funciones puras (objetivo 100% cobertura).
 */
import { ExerciseProfile } from '@/models';
import { relativeE1RMChange } from './e1rm';

/** Peso biomecánico w_i por perfil de ejercicio (PRD §3.2.2). */
export const PROFILE_WEIGHT: Record<ExerciseProfile, number> = {
  [ExerciseProfile.COMPOUND_PRIMARY]: 0.5,
  [ExerciseProfile.COMPOUND_SECONDARY]: 0.35,
  [ExerciseProfile.ISOLATION]: 0.15,
};

/** Contribución de un ejercicio al MPI del grupo. */
export interface ExerciseContribution {
  /** Peso biomecánico (usa PROFILE_WEIGHT si se pasa un profile). */
  weight: number;
  /** Variación relativa de e1RM (fracción, 0.05 = +5%). */
  deltaE1RM: number;
}

/**
 * MPI del grupo a partir de contribuciones ya calculadas.
 * Devuelve una FRACCIÓN (0.042 = +4.2%). Lista vacía → 0 (sin datos, sin progreso).
 * El divisor Σw normaliza sobre los ejercicios presentes (tolerancia a swaps).
 */
export function muscleProgressIndex(contributions: ExerciseContribution[]): number {
  if (contributions.length === 0) return 0;
  let weightedSum = 0;
  let weightTotal = 0;
  for (const c of contributions) {
    if (!Number.isFinite(c.weight) || c.weight <= 0) {
      throw new Error('muscleProgressIndex: weight debe ser > 0');
    }
    if (!Number.isFinite(c.deltaE1RM)) {
      throw new Error('muscleProgressIndex: deltaE1RM debe ser finito');
    }
    weightedSum += c.weight * c.deltaE1RM;
    weightTotal += c.weight;
  }
  return weightedSum / weightTotal;
}

/** Un ejercicio con su perfil biomecánico y sus e1RM actual/baseline. */
export interface ExerciseE1RMInput {
  profile: ExerciseProfile;
  baselineE1RM: number;
  currentE1RM: number;
}

/**
 * Calcula el MPI del grupo directamente desde e1RM actual/baseline por ejercicio.
 * Traduce cada perfil a su peso y cada par (actual, baseline) a su Δe1RM.
 */
export function muscleProgressIndexFromE1RM(exercises: ExerciseE1RMInput[]): number {
  const contributions = exercises.map((e) => ({
    weight: PROFILE_WEIGHT[e.profile],
    deltaE1RM: relativeE1RMChange(e.currentE1RM, e.baselineE1RM),
  }));
  return muscleProgressIndex(contributions);
}
