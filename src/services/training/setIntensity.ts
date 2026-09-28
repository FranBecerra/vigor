/**
 * Prescripción de intensidad SERIE A SERIE — LÓGICA PURA (PRD §8.7).
 *
 * Un ejercicio no se prescribe con un único RIR: lo habitual es dejar más
 * reserva en las primeras series y apretar en las últimas. Mostrar un solo badge
 * por ejercicio ocultaba esa progresión, que es justo la información útil.
 *
 * `targetRIR` se conserva como RESUMEN del ejercicio; estas funciones derivan la
 * lista real por serie, para que nunca se desincronice del número de series.
 */

/** RIR mínimo y máximo admitidos en una prescripción. */
export const MIN_RIR = 0;
export const MAX_RIR = 5;

/**
 * Acota un RIR al rango válido, en ENTEROS. A prescribed set asks for a whole
 * number of reps in reserve; "2.5 in reserve" is not something an athlete can
 * execute. Halves round up, toward more reserve, which is the safe side.
 */
export function clampSetRIR(value: number): number {
  if (!Number.isFinite(value)) return MIN_RIR;
  const rounded = Math.round(value);
  return Math.min(MAX_RIR, Math.max(MIN_RIR, rounded));
}

/**
 * Deriva el RIR de cada serie a partir del RIR objetivo del ejercicio.
 *
 * Regla: la ÚLTIMA serie va al RIR objetivo y las anteriores dejan un punto más
 * de reserva por cada posición hacia atrás, hasta un tope de `maxExtraReserve`.
 * Así un ejercicio a RIR 2 con 3 series queda 4 · 3 · 2 en lugar de 2 · 2 · 2.
 *
 * Con 0 series devuelve lista vacía: no se inventan prescripciones.
 */
export function deriveSetRIRs(
  targetRIR: number,
  workingSets: number,
  maxExtraReserve = 2,
): number[] {
  if (workingSets <= 0) return [];
  const base = clampSetRIR(targetRIR);
  return Array.from({ length: workingSets }, (_, index) => {
    const positionsFromLast = workingSets - 1 - index;
    const extra = Math.min(maxExtraReserve, positionsFromLast);
    return clampSetRIR(base + extra);
  });
}

/**
 * Aplica el endurecimiento de un microciclo a una lista de RIR por serie.
 * `intensityAdjustmentRIR` negativo = más intensidad (menos reserva).
 */
export function adjustSetRIRs(setRIRs: readonly number[], adjustmentRIR: number): number[] {
  return setRIRs.map((rir) => clampSetRIR(rir + adjustmentRIR));
}

/** Formatea una prescripción por serie: `4 · 3 · 2`. */
export function formatSetRIRs(setRIRs: readonly number[]): string {
  return setRIRs.map((rir) => (Number.isInteger(rir) ? String(rir) : rir.toFixed(1))).join(' · ');
}
