/**
 * e1RM — 1RM estimado (fórmula de Epley).
 * PRD §3.2. Base de todo el análisis de progreso.
 *
 * Epley: e1RM = peso × (1 + reps/30)
 * - Con reps = 1, e1RM = peso (un 1RM real).
 * - A más reps, mayor el 1RM estimado.
 *
 * Funciones puras y deterministas (objetivo 100% cobertura).
 */

/**
 * Calcula el 1RM estimado por Epley.
 * @param weight peso levantado (kg), > 0
 * @param reps repeticiones realizadas, entero >= 1
 * @throws si los inputs no son válidos
 */
export function epleyE1RM(weight: number, reps: number): number {
  if (!Number.isFinite(weight) || weight <= 0) {
    throw new Error('epleyE1RM: weight debe ser un número > 0');
  }
  if (!Number.isInteger(reps) || reps < 1) {
    throw new Error('epleyE1RM: reps debe ser un entero >= 1');
  }
  return weight * (1 + reps / 30);
}

/**
 * Variación relativa de e1RM respecto a un baseline (PRD §3.2.1):
 *   Δe1RM = (actual − baseline) / baseline
 * Devuelve una fracción (0.05 = +5%).
 * @throws si baseline <= 0
 */
export function relativeE1RMChange(current: number, baseline: number): number {
  if (!Number.isFinite(baseline) || baseline <= 0) {
    throw new Error('relativeE1RMChange: baseline debe ser un número > 0');
  }
  if (!Number.isFinite(current) || current < 0) {
    throw new Error('relativeE1RMChange: current debe ser un número >= 0');
  }
  return (current - baseline) / baseline;
}
